# syntax=docker/dockerfile:1.6
FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG PUBLIC_API_BASE
ARG PUBLIC_APP_NAME="PQ Media"
ARG TARGETARCH

ENV PUBLIC_API_BASE=${PUBLIC_API_BASE}
ENV PUBLIC_APP_NAME=${PUBLIC_APP_NAME}

COPY package.json package-lock.json* ./
RUN npm install --include=optional \
	&& ROLLDOWN_X64_GNU_VERSION="$(node -p "require('./node_modules/rolldown/package.json').optionalDependencies['@rolldown/binding-linux-x64-gnu']")" \
	&& ROLLDOWN_ARM64_GNU_VERSION="$(node -p "require('./node_modules/rolldown/package.json').optionalDependencies['@rolldown/binding-linux-arm64-gnu']")" \
	&& LIGHTNINGCSS_X64_GNU_VERSION="$(node -p "require('./node_modules/lightningcss/package.json').optionalDependencies['lightningcss-linux-x64-gnu']")" \
	&& LIGHTNINGCSS_ARM64_GNU_VERSION="$(node -p "require('./node_modules/lightningcss/package.json').optionalDependencies['lightningcss-linux-arm64-gnu']")" \
	&& TAILWIND_OXIDE_X64_GNU_VERSION="$(node -p "require('./node_modules/@tailwindcss/oxide/package.json').optionalDependencies['@tailwindcss/oxide-linux-x64-gnu']")" \
	&& TAILWIND_OXIDE_ARM64_GNU_VERSION="$(node -p "require('./node_modules/@tailwindcss/oxide/package.json').optionalDependencies['@tailwindcss/oxide-linux-arm64-gnu']")" \
	&& case "$TARGETARCH" in \
		amd64) npm install --no-save \
			"@rolldown/binding-linux-x64-gnu@${ROLLDOWN_X64_GNU_VERSION}" \
			"lightningcss-linux-x64-gnu@${LIGHTNINGCSS_X64_GNU_VERSION}" \
			"@tailwindcss/oxide-linux-x64-gnu@${TAILWIND_OXIDE_X64_GNU_VERSION}" ;; \
		arm64) npm install --no-save \
			"@rolldown/binding-linux-arm64-gnu@${ROLLDOWN_ARM64_GNU_VERSION}" \
			"lightningcss-linux-arm64-gnu@${LIGHTNINGCSS_ARM64_GNU_VERSION}" \
			"@tailwindcss/oxide-linux-arm64-gnu@${TAILWIND_OXIDE_ARM64_GNU_VERSION}" ;; \
		*) echo "Unsupported TARGETARCH: $TARGETARCH" && exit 1 ;; \
	esac

COPY . ./

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
