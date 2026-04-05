# Korean Dictation Lab

Website luyen nghe chep chinh ta tieng Han, duoc xay dung bang React (Next.js App Router), co:

- Dang nhap/Dang ky voi Google (NextAuth)
- Luu du lieu vao database PostgreSQL (Prisma)
- Cham diem bai chep tu dong
- Luu lich su luyen tap theo tung tai khoan

## 1. Cai dat

```bash
npm install
```

## 2. Cau hinh bien moi truong

Tao file `.env.local` va dien thong tin:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_SECRET="mot_chuoi_bi_mat_dai"
NEXTAUTH_URL="http://localhost:3000"
```

`NEXTAUTH_SECRET` co the tao nhanh bang lenh:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Cau hinh Google OAuth

Trong Google Cloud Console:

1. Tao OAuth client type `Web application`.
2. Authorized redirect URI:

```txt
http://localhost:3000/api/auth/callback/google
https://dailydictation-rlms.vercel.app/api/auth/callback/google
```

3. Copy `Client ID` va `Client Secret` vao `.env`.

## 4. Tao database

```bash
npx prisma generate
npx prisma db push
```

## 5. Chay project

```bash
npm run dev
```

Truy cap `http://localhost:3000`.

## Scripts

- `npm run dev`: Chay local
- `npm run build`: Build production
- `npm run db:migrate`: Tao/cap nhat migration
- `npm run db:studio`: Mo Prisma Studio

## Kien truc chinh

- Google auth: `src/app/api/auth/[...nextauth]/route.ts`
- Prisma schema: `prisma/schema.prisma`
- Dashboard luyen nghe: `src/app/dashboard/page.tsx`
- API luu bai nop: `src/app/api/attempts/route.ts`
