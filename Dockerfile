# Asistan Merkezi uygulama imajı (Next.js standalone).
# NEXT_PUBLIC_* değerleri build anında istemci koduna GÖMÜLÜR; adres/anahtar
# değişirse imaj yeniden build edilmeli (runtime env yetmez).
FROM node:24-alpine AS bagimliliklar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS derleme
WORKDIR /app
COPY --from=bagimliliklar /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS calisma
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S uygulama && adduser -S uygulama -G uygulama
COPY --from=derleme --chown=uygulama:uygulama /app/.next/standalone ./
COPY --from=derleme --chown=uygulama:uygulama /app/.next/static ./.next/static
COPY --from=derleme --chown=uygulama:uygulama /app/public ./public
USER uygulama
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
