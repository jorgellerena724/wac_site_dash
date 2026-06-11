# ==================== ETAPA 1: BUILDER ========================
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para compilación nativa
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# 1. Copiar archivos de dependencias
COPY package.json package-lock.json* ./

# 2. Instalar dependencias (con fallback para compatibilidad)
RUN npm ci --legacy-peer-deps --no-audit --prefer-offline || \
    npm install --legacy-peer-deps --no-audit --prefer-offline

# 3. Copiar todo el código fuente
COPY . .

# 4. Build de Angular con SSR
RUN npm run build -- \
  --configuration=production \
  --output-path=dist \
  --output-hashing=all \
  --source-map=false

# 5. Verificación de la estructura generada
RUN echo "📁 === Estructura de build generada ===" && \
    echo "📄 index.html size:" && wc -c dist/browser/index.html && \
    echo "📄 index.csr.html size:" && wc -c dist/browser/index.csr.html && \
    echo "📁 Browser files count:" && find dist/browser -type f | wc -l && \
    echo "✅ Build completado exitosamente"

# ==================== ETAPA 2: PRODUCCIÓN ====================
FROM nginx:alpine

# Metadatos de la imagen
LABEL org.opencontainers.image.source="https://github.com/$GITHUB_REPOSITORY"
LABEL org.opencontainers.image.description="WEP Admin Dashboard - Angular Application"
LABEL org.opencontainers.image.licenses="MIT"

# 1. Limpiar contenido por defecto de Nginx
RUN rm -rf /usr/share/nginx/html/*

# 2. Copiar archivos estáticos desde la etapa de builder
COPY --from=builder /app/dist/browser /usr/share/nginx/html

# 3. Usar index.csr.html como index.html principal (CRUCIAL)
RUN mv /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html && \
    rm -f /usr/share/nginx/html/index.csr.html

# 4. Verificación de archivos copiados
RUN echo "🔍 === Verificación de despliegue ===" && \
    echo "📂 Archivos en /usr/share/nginx/html/:" && \
    ls -la /usr/share/nginx/html/ | head -15 && \
    echo "" && \
    echo "📊 Tamaño del index.html:" && \
    wc -c /usr/share/nginx/html/index.html && \
    echo "" && \
    echo "📝 Primeras líneas de index.html:" && \
    head -3 /usr/share/nginx/html/index.html && \
    echo "" && \
    echo "📦 Archivos JavaScript principales:" && \
    ls -la /usr/share/nginx/html/*.js 2>/dev/null | head -5 || echo "No JS files found" && \
    echo "✅ Verificación completada"

# 5. Copiar configuración personalizada de Nginx
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 6. Healthcheck para monitoreo
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O- http://localhost:80 >/dev/null 2>&1 || exit 1

# 7. Exponer puerto y comando por defecto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]