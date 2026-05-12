package ai

// PromptVersion lets us A/B prompt revisions later without breaking the DB.
const PromptVersion = "v1"

// Shared system instruction. All content is generated for a Russian-speaking
// audience on svoe-rodnoe.ru. We forbid emojis-as-clickbait, English copy,
// and made-up claims about product origin or health benefits.
const SystemRU = `Ты — маркетинг-ассистент маркетплейса "Своё Родное" (svoe-rodnoe.ru).
Все ответы — на русском языке, тёплый дружеский тон, без кликбейта.
Запрещено: эмодзи-флуд (>1 на текст), вымышленные факты о фермере или продукте,
ложные обещания пользы, спам-маркеры ("СКОРЕЕ", "АКЦИЯ ДНЯ").
Опирайся ТОЛЬКО на переданные данные о фермере и товарах.
Возвращай строгий JSON по переданной схеме.`

// --- tagging ------------------------------------------------------------

// SchemaTagging — Gemini responseSchema for product tagging.
var SchemaTagging = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"tags": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
		"confidence": map[string]any{"type": "number"},
	},
	"required": []string{"tags", "confidence"},
}

func TaggingPrompt(productName, productDesc, category string) string {
	return `Задача: присвоить продукту 3-8 тегов из словаря, описывающих его маркетинговые свойства.

Словарь допустимых тегов:
seasonal, premium, gift, gift_basket, vegan, vegetarian, kids_friendly, no_sugar, gourmet, healthy,
easter, christmas, maslenitsa, lent, new_year, victory_day, defenders_day, womens_day, summer, autumn, winter, spring,
honey, mead, propolis, beeswax, cheese, cheese_aged, cheese_blue, cheese_fresh,
butter, butter_cultured, sour_cream, yogurt_live, kefir, cottage_cheese, milk_fresh, eggs,
bread_artisan, sourdough, rye, kulich, paskha, pirog, blini_flour, pirog_with_honey,
shashlik, marinade, sausage_dry, sausage_grill, jerky, smoked_meat, smoked_fish, lamb, goose, duck, sturgeon, caviar, caviar_premium, fish_fresh, milk_fed,
strawberry, raspberry, blueberry, blackcurrant, redcurrant, cherry, gooseberry, apple, apple_autumn, pumpkin, cranberry, lingonberry,
sorrel, nettle, ramson, radish, green_onion, dill, spinach, microgreen,
porcini, chanterelle, oyster_mushroom, saffron_milk_cap, mushroom_dried, mushroom_pickled,
sauerkraut, pickled_cucumber, pickled_tomato, soaked_apple,
jam, jam_berry, jam_apple, granola, granola_kids, nuts, walnut, hazelnut, pine_nut, dried_fruits, raisins_premium, condensed_milk,
wine, kvass, kombucha, herbal_blend, tea, mead, cider, vinegar_apple,
plant_milk, legumes, tofu, seitan, regional_specialty, moscow_region, local, fresh, hand_packed, ribbon, subscription_friendly, weekly_box,
rare, truffle, aged, hand_picked, wild, fruit_lunchbox

Правила:
- выбирай 3-8 наиболее точных тегов;
- если продукт не имеет ярких сезонных/праздничных маркеров — оставь только функциональные теги (например premium, gift, kids_friendly);
- не используй теги, которые могут быть ложными ("vegan" только если состав явно растительный).

Данные товара:
Название: ` + productName + `
Категория: ` + category + `
Описание: ` + truncate(productDesc, 1200) + `

Верни JSON: {"tags":[...], "confidence": 0.0-1.0}`
}

// --- push ---------------------------------------------------------------

var SchemaPush = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"title": map[string]any{"type": "string"},
		"body":  map[string]any{"type": "string"},
	},
	"required": []string{"title", "body"},
}

func PushPrompt(farmer, eventTitle, eventType, productsBlock string) string {
	return `Сгенерируй пуш-уведомление для покупателей маркетплейса.

Фермер: ` + farmer + `
Событие: ` + eventTitle + ` (тип: ` + eventType + `)
Подходящие товары фермера:
` + productsBlock + `

Ограничения:
- title: ≤ 36 символов, без точки в конце.
- body: ≤ 120 символов, одно предложение, одна мысль.
- Без эмодзи (или максимум один в title).

JSON: {"title":"...", "body":"..."}`
}

// --- story --------------------------------------------------------------

var SchemaStory = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"caption":      map[string]any{"type": "string"},
		"image_prompt": map[string]any{"type": "string"},
	},
	"required": []string{"caption", "image_prompt"},
}

func StoryPrompt(farmer, eventTitle, productsBlock string) string {
	return `Сгенерируй сторис для приложения "Своё Родное".

Фермер: ` + farmer + `
Событие: ` + eventTitle + `
Товары:
` + productsBlock + `

Требования:
- caption: 80-180 символов, кратко и тепло; упомяни 1 товар и событие.
- image_prompt: на английском, краткое описание сцены для генератора картинок (Stable Diffusion).

JSON: {"caption":"...", "image_prompt":"..."}`
}

// --- blog ---------------------------------------------------------------

var SchemaBlog = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"title":    map[string]any{"type": "string"},
		"lede":     map[string]any{"type": "string"},
		"body":     map[string]any{"type": "string"},
		"hashtags": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
	},
	"required": []string{"title", "lede", "body"},
}

func BlogPrompt(farmer, eventTitle, productsBlock string) string {
	return `Напиши короткую статью для блога svoe-rodnoe.ru.

Фермер: ` + farmer + `
Событие: ` + eventTitle + `
Товары фермера:
` + productsBlock + `

Структура:
- title: ≤ 60 символов;
- lede: 1-2 предложения, ≤ 220 символов;
- body: 600-900 символов, 3-4 коротких абзаца; упомяни 2-3 товара и их роль в событии.
- hashtags: 3-6 коротких тегов на русском, без пробелов внутри тега.

JSON: {"title":"...", "lede":"...", "body":"...", "hashtags":[...]}`
}

// --- recipe -------------------------------------------------------------

var SchemaRecipe = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"name":        map[string]any{"type": "string"},
		"yield":       map[string]any{"type": "string"},
		"time":        map[string]any{"type": "string"},
		"ingredients": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"steps":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
	},
	"required": []string{"name", "ingredients", "steps"},
}

func RecipePrompt(eventTitle, productsBlock string) string {
	return `Сгенерируй сезонный рецепт для блюда, в котором используется хотя бы 2 товара из списка.

Событие: ` + eventTitle + `
Товары:
` + productsBlock + `

Требования:
- name: ≤ 60 символов;
- yield: например "4 порции";
- time: например "40 минут";
- ingredients: 5-10 строк, формат "наименование — количество";
- steps: 4-7 кратких шагов, по одному предложению на шаг.

JSON: {"name":"...","yield":"...","time":"...","ingredients":[...],"steps":[...]}`
}

// --- chat ---------------------------------------------------------------

var SchemaChat = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"segment": map[string]any{"type": "string"},
		"message": map[string]any{"type": "string"},
	},
	"required": []string{"segment", "message"},
}

func ChatPrompt(farmer, eventTitle, productsBlock string) string {
	return `Сгенерируй личное сообщение в чат повторным покупателям фермера.

Фермер: ` + farmer + `
Событие: ` + eventTitle + `
Товары:
` + productsBlock + `

Требования:
- segment: одна из строк: "repeat_buyers", "subscribers", "premium_buyers"
- message: ≤ 320 символов, обращение на "вы", без приветствий-штампов.
  Упомяни предыдущий заказ как контекст ("в прошлый раз вам понравился ...").

JSON: {"segment":"...", "message":"..."}`
}

// --- social -------------------------------------------------------------

var SchemaSocial = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"title":    map[string]any{"type": "string"},
		"text":     map[string]any{"type": "string"},
		"hashtags": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
	},
	"required": []string{"title", "text", "hashtags"},
}

func SocialPrompt(farmer, eventTitle, productsBlock string) string {
	return `Сгенерируй пост для Telegram-канала фермера.

Фермер: ` + farmer + `
Событие: ` + eventTitle + `
Товары:
` + productsBlock + `

Требования:
- title: ≤ 60 символов, без эмодзи.
- text: 400-600 символов, дружеский тон, упомяни сезонность.
  В конце — призыв: "Закажите на svoe-rodnoe.ru".
- hashtags: 3-6 на русском.

JSON: {"title":"...", "text":"...", "hashtags":[...]}`
}

// --- helpers ------------------------------------------------------------

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
