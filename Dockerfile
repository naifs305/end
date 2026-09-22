# ---------- مرحلة البناء ----------
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
# prisma قبل npm ci — لأن postinstall يشغّل prisma generate
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# لا نستخدم npm run build لأنه يتضمن db push (يتطلب اتصالًا بقاعدة)
RUN npx prisma@5.22.0 generate && npx next build
# ---------- مرحلة التشغيل ----------
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3010
CMD ["sh", "-c", "npx prisma@5.22.0 db push --skip-generate && node prisma/seed.js && npm run start"]
