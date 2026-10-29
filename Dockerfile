# Megagyn Service — imagem única para o app (next start) e o worker de PDFs (npm run worker).
# Base com Chromium e fontes do Playwright (necessário para gerar os PDFs).
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* são lidas em tempo de execução pelo servidor; nenhum segredo entra na imagem.
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
USER pwuser
EXPOSE 3000
# App:    docker run --env-file .env.production -p 3000:3000 megagyn
# Worker: docker run --env-file .env.production megagyn npm run worker
CMD ["npm", "run", "start"]
