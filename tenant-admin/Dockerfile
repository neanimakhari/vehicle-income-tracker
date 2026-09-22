FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
# Server-side: reach API from inside Docker (http://api:3000)
ARG API_URL=http://api:3000
ENV API_URL=${API_URL}
# Client-side: public API URL (set at build for production e.g. https://api.yourdomain.com)
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Shown in sidebar footer; keep in sync with package.json version / platform tag
ARG NEXT_PUBLIC_APP_VERSION=1.2.0
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=512
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
EXPOSE 3002
CMD ["npm", "run", "start"]



