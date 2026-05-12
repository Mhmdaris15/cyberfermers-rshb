FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/import ./cmd/import && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/seed ./cmd/seed && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/tag-products ./cmd/tag-products

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Europe/Moscow
WORKDIR /app
COPY --from=build /out/server /app/bin/server
COPY --from=build /out/import /app/bin/import
COPY --from=build /out/seed /app/bin/seed
COPY --from=build /out/tag-products /app/bin/tag-products

EXPOSE 8080
ENTRYPOINT ["/app/bin/server"]
