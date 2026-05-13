package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const apiBase = "https://generativelanguage.googleapis.com/v1beta"

// Client is a minimal Gemini REST client. We avoid the official SDK to keep the
// binary tiny and the dependency graph clean. All structured generation goes
// through GenerateJSON which enforces a responseSchema.
type Client struct {
	APIKey     string
	Model      string
	EmbedModel string
	HTTP       *http.Client
}

func NewClient(apiKey, model, embed string) *Client {
	return &Client{
		APIKey:     apiKey,
		Model:      model,
		EmbedModel: embed,
		HTTP:       &http.Client{Timeout: 60 * time.Second},
	}
}

// --- types --------------------------------------------------------------

// Part is exported so the chat package can compose multi-turn histories with
// mixed text + functionCall + functionResponse segments.
type Part struct {
	Text             string            `json:"text,omitempty"`
	FunctionCall     *FunctionCall     `json:"functionCall,omitempty"`
	FunctionResponse *FunctionResponse `json:"functionResponse,omitempty"`
}

type FunctionCall struct {
	Name string         `json:"name"`
	Args map[string]any `json:"args,omitempty"`
}

type FunctionResponse struct {
	Name     string         `json:"name"`
	Response map[string]any `json:"response,omitempty"`
}

type Content struct {
	Role  string `json:"role,omitempty"` // "user" | "model" | "function"
	Parts []Part `json:"parts"`
}

// keep internal aliases for the existing structured-JSON path
type part = Part
type content = Content

type generationConfig struct {
	Temperature      float64 `json:"temperature,omitempty"`
	TopP             float64 `json:"topP,omitempty"`
	MaxOutputTokens  int     `json:"maxOutputTokens,omitempty"`
	ResponseMimeType string  `json:"responseMimeType,omitempty"`
	ResponseSchema   any     `json:"responseSchema,omitempty"`
}

// ToolDecl is one function-tool declaration, in Gemini's wire shape.
type ToolDecl struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type tool struct {
	FunctionDeclarations []ToolDecl `json:"functionDeclarations"`
}

type generateReq struct {
	SystemInstruction *content         `json:"systemInstruction,omitempty"`
	Contents          []content        `json:"contents"`
	GenerationConfig  generationConfig `json:"generationConfig"`
	Tools             []tool           `json:"tools,omitempty"`
}

type generateResp struct {
	Candidates []struct {
		Content      content `json:"content"`
		FinishReason string  `json:"finishReason"`
	} `json:"candidates"`
	UsageMetadata struct {
		TotalTokenCount int `json:"totalTokenCount"`
	} `json:"usageMetadata"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// --- public API ---------------------------------------------------------

// GenerateJSON calls Gemini with a hard JSON schema and unmarshals into `out`.
// `schema` must be a `map[string]any` shaped like a Gemini responseSchema.
func (c *Client) GenerateJSON(ctx context.Context, system, user string, schema any, out any) error {
	if c.APIKey == "" {
		return errors.New("GEMINI_API_KEY missing")
	}
	body := generateReq{
		Contents: []content{
			{Role: "user", Parts: []part{{Text: user}}},
		},
		GenerationConfig: generationConfig{
			Temperature:      0.6,
			TopP:             0.95,
			MaxOutputTokens:  2048,
			ResponseMimeType: "application/json",
			ResponseSchema:   schema,
		},
	}
	if system != "" {
		body.SystemInstruction = &content{Parts: []part{{Text: system}}}
	}
	raw, err := c.callGenerate(ctx, body)
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(raw), out)
}

// ChatTurn returns the next message from Gemini given the full history +
// declared tools. The caller is responsible for executing any FunctionCall
// returned (one tool per turn) and looping back with a functionResponse Part.
//
// Multi-turn shape:
//   1. user message → call ChatTurn(history, tools)
//   2. response has Parts=[FunctionCall] → execute → append functionResponse
//      → call ChatTurn again
//   3. response has Parts=[Text] → done
func (c *Client) ChatTurn(ctx context.Context, system string, history []Content, tools []ToolDecl) (Content, error) {
	if c.APIKey == "" {
		return Content{}, errors.New("GEMINI_API_KEY missing")
	}
	body := generateReq{
		Contents: history,
		GenerationConfig: generationConfig{
			Temperature:     0.4,
			TopP:            0.9,
			MaxOutputTokens: 1024,
		},
	}
	if system != "" {
		body.SystemInstruction = &Content{Parts: []Part{{Text: system}}}
	}
	if len(tools) > 0 {
		body.Tools = []tool{{FunctionDeclarations: tools}}
	}
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", apiBase, c.Model, c.APIKey)
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return Content{}, err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return Content{}, fmt.Errorf("gemini chat http %d: %s", resp.StatusCode, string(rb))
	}
	var gr generateResp
	if err := json.Unmarshal(rb, &gr); err != nil {
		return Content{}, err
	}
	if gr.Error != nil {
		return Content{}, fmt.Errorf("gemini chat: %s", gr.Error.Message)
	}
	if len(gr.Candidates) == 0 {
		return Content{}, errors.New("gemini chat: empty response")
	}
	return gr.Candidates[0].Content, nil
}

// GenerateText is a free-form generation. Avoid in production paths; use
// GenerateJSON to keep downstream code deterministic.
func (c *Client) GenerateText(ctx context.Context, system, user string) (string, error) {
	body := generateReq{
		Contents:         []content{{Role: "user", Parts: []part{{Text: user}}}},
		GenerationConfig: generationConfig{Temperature: 0.7, MaxOutputTokens: 1024},
	}
	if system != "" {
		body.SystemInstruction = &content{Parts: []part{{Text: system}}}
	}
	return c.callGenerate(ctx, body)
}

// Embed returns a single-vector embedding via Gemini text-embedding-004.
func (c *Client) Embed(ctx context.Context, text string) ([]float64, error) {
	if c.APIKey == "" {
		return nil, errors.New("GEMINI_API_KEY missing")
	}
	url := fmt.Sprintf("%s/models/%s:embedContent?key=%s", apiBase, c.EmbedModel, c.APIKey)
	reqBody := map[string]any{
		"model": "models/" + c.EmbedModel,
		"content": map[string]any{
			"parts": []map[string]any{{"text": text}},
		},
	}
	buf, _ := json.Marshal(reqBody)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("embed: %s", string(rb))
	}
	var er struct {
		Embedding struct {
			Values []float64 `json:"values"`
		} `json:"embedding"`
	}
	if err := json.Unmarshal(rb, &er); err != nil {
		return nil, err
	}
	return er.Embedding.Values, nil
}

// --- internals ----------------------------------------------------------

func (c *Client) callGenerate(ctx context.Context, body generateReq) (string, error) {
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", apiBase, c.Model, c.APIKey)
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("gemini http %d: %s", resp.StatusCode, string(rb))
	}
	var gr generateResp
	if err := json.Unmarshal(rb, &gr); err != nil {
		return "", err
	}
	if gr.Error != nil {
		return "", fmt.Errorf("gemini api: %s", gr.Error.Message)
	}
	if len(gr.Candidates) == 0 || len(gr.Candidates[0].Content.Parts) == 0 {
		return "", errors.New("gemini: empty response")
	}
	return gr.Candidates[0].Content.Parts[0].Text, nil
}
