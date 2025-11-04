# build
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend ./
RUN CGO_ENABLED=0 go build -o /api ./cmd/api

# run
FROM gcr.io/distroless/base-debian12
ENV HTTP_ADDR=:8080
EXPOSE 8080
COPY --from=build /api /api
ENTRYPOINT ["/api"]
