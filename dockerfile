# Etapa de build
FROM node:24-alpine AS builder

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm@latest

# 1. Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ecosystem.config.js ./

# 2. Instalar dependencias con pnpm (frozen lockfile para CI/reproducibilidad)
RUN pnpm install --frozen-lockfile

# 3. Copiar todo el código fuente
COPY . .

# 4. Build de Angular con pnpm
RUN pnpm run build

# Etapa de producción
FROM node:24-alpine

# Instalar PM2 y pnpm (necesario para ejecutar scripts de producción si usas pnpm start)
RUN npm install -g pm2@latest pnpm@latest

WORKDIR /app

# Copiar solo lo esencial
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/ecosystem.config.js ./

# Instalar SOLO dependencias de producción con pnpm
RUN pnpm install --prod --frozen-lockfile

# Copiar el build de Angular
COPY --from=builder /app/dist ./dist

# Logs
RUN mkdir -p logs

EXPOSE 4004
ENV NODE_ENV=production

# Usar pnpm para ejecutar el comando start (que definimos en package.json)
CMD ["pnpm", "start"]