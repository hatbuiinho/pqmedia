# syntax=docker/dockerfile:1.6
FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG PUBLIC_API_BASE
ARG PUBLIC_APP_NAME="PQ Media"

ENV PUBLIC_API_BASE=${PUBLIC_API_BASE}
ENV PUBLIC_APP_NAME=${PUBLIC_APP_NAME}

COPY package.json package-lock.json ./
RUN npm ci \
	&& ROLLDOWN_LINUX_X64_GNU_VERSION="$(node -p "require('./node_modules/rolldown/package.json').optionalDependencies['@rolldown/binding-linux-x64-gnu']")" \
	&& npm install --no-save --ignore-scripts "@rolldown/binding-linux-x64-gnu@${ROLLDOWN_LINUX_X64_GNU_VERSION}"

COPY . ./

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
