# syntax=docker/dockerfile:1.6
FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG PUBLIC_API_BASE
ARG PUBLIC_APP_NAME="PQ Media"

ENV PUBLIC_API_BASE=${PUBLIC_API_BASE}
ENV PUBLIC_APP_NAME=${PUBLIC_APP_NAME}

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
