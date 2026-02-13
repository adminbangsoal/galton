# 🚀 Panduan Setup Vercel untuk Galton (Backend)

Panduan lengkap untuk setup CI/CD Vercel untuk project Galton (NestJS Backend).

---

## 📋 Daftar Isi

1. [Persiapan yang Diperlukan](#persiapan-yang-diperlukan)
2. [Setup Vercel Project](#setup-vercel-project)
3. [Setup GitHub Secrets](#setup-github-secrets)
4. [Setup Environment Variables di Vercel](#setup-environment-variables-di-vercel)
5. [Verifikasi Deployment](#verifikasi-deployment)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Persiapan yang Diperlukan

### 1. Akun Vercel
- Daftar/login di [vercel.com](https://vercel.com)
- Pastikan punya akses ke organization/project

### 2. Akun GitHub
- Repository sudah di-push ke GitHub
- Punya akses untuk menambahkan secrets

### 3. Vercel CLI (Opsional - untuk mendapatkan Project ID)
```bash
pnpm install -g vercel
```

---

## 🎯 Setup Vercel Project

### Step 1: Import Project ke Vercel

1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik **"Add New..."** → **"Project"**
3. Import repository GitHub Anda (pilih repository yang berisi folder `galton`)
4. **JANGAN** klik deploy sekarang, kita akan setup GitHub Actions dulu

### Step 2: Konfigurasi Project Settings

Di Vercel Dashboard → Project Settings → General:

- **Framework Preset**: Other
- **Root Directory**: `galton` (jika repo root, atau kosongkan jika repo langsung berisi galton)
- **Build Command**: `pnpm install && pnpm run build`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install`
- **Node.js Version**: `20.x`

**Catatan**: Vercel akan menggunakan `vercel.json` yang sudah dibuat untuk konfigurasi routing.

---

## 🔐 Setup GitHub Secrets

Secrets ini diperlukan untuk GitHub Actions workflow agar bisa deploy ke Vercel.

### Step 1: Buka GitHub Repository Settings

1. Buka repository GitHub Anda
2. Pergi ke **Settings** → **Secrets and variables** → **Actions**
3. Klik **"New repository secret"**

### Step 2: Tambahkan Secrets Berikut

#### 1. VERCEL_TOKEN

**Cara mendapatkan:**
1. Pergi ke [Vercel Account Settings → Tokens](https://vercel.com/account/tokens)
2. Klik **"Create Token"**
3. Beri nama token (contoh: "github-actions-galton")
4. Copy token yang dihasilkan
5. **PENTING**: Token hanya ditampilkan sekali, simpan dengan aman!

**Di GitHub:**
- Name: `VERCEL_TOKEN`
- Secret: (paste token yang sudah di-copy)

#### 2. VERCEL_ORG_ID

**Cara mendapatkan:**

**Opsi A: Via Vercel CLI (Recommended)**
```bash
cd galton
vercel link
# Pilih project yang sudah dibuat di Vercel
# File .vercel/project.json akan dibuat dengan informasi ini
```

Buka file `.vercel/project.json`:
```json
{
  "orgId": "team_xxxxx",  // <- Ini VERCEL_ORG_ID
  "projectId": "prj_xxxxx"  // <- Ini VERCEL_PROJECT_ID
}
```

**Opsi B: Via Vercel Dashboard**
1. Buka project di Vercel Dashboard
2. URL akan seperti: `https://vercel.com/[org-name]/[project-name]/settings`
3. `[org-name]` adalah organization ID (bisa berupa username atau team name)
4. Atau lihat di Settings → General → Team/Organization

**Di GitHub:**
- Name: `VERCEL_ORG_ID`
- Secret: (paste org ID, contoh: `team_xxxxx` atau username)

#### 3. VERCEL_PROJECT_ID

**Cara mendapatkan:**

**Opsi A: Via Vercel CLI (Recommended)**
- Sama seperti di atas, lihat di file `.vercel/project.json`
- Atau setelah `vercel link`, bisa lihat di output terminal

**Opsi B: Via Vercel Dashboard**
1. Buka project di Vercel Dashboard
2. Pergi ke **Settings** → **General**
3. Scroll ke bawah, lihat **Project ID** (format: `prj_xxxxx`)

**Di GitHub:**
- Name: `VERCEL_PROJECT_ID`
- Secret: (paste project ID, contoh: `prj_xxxxx`)

### Step 3: Setup GitHub Environment

1. Di GitHub Repository, perg ke **Settings** → **Environments**
2. Klik **"New environment"**
3. Name: `github-actions`
4. Klik **"Configure environment"**
5. **Tidak perlu** tambahkan secrets di sini (karena sudah di repository secrets)
6. Klik **"Save protection rules"**

**Catatan**: Environment `github-actions` digunakan di workflow untuk mengakses secrets.

---

## 🌍 Setup Environment Variables di Vercel

### Step 1: Buka Environment Variables Settings

1. Di Vercel Dashboard, buka project **Galton**
2. Pergi ke **Settings** → **Environment Variables**

### Step 2: Tambahkan Environment Variables

Ikuti checklist dari file `VERCEL_ENV_VARIABLES.md` untuk daftar lengkap environment variables.

**Penting**: Saat menambahkan variable, centang environment yang sesuai:
- ✅ **Production** - untuk branch `main`
- ✅ **Preview** - untuk semua branch selain `main`
- ✅ **Development** - untuk local development (opsional)

### Step 3: Variable yang Perlu Dibedakan

**Production (branch `main`):**
- `NODE_ENV=production`
- `MIDTRANS_SERVER_KEY` - Production key
- `FRONTEND_URL` - ⚠️ Set setelah Francis deploy

**Preview (branch `dev` atau branch lain):**
- `NODE_ENV=development` ⚠️ **PENTING: Harus berbeda dari Production**
- `MIDTRANS_SERVER_KEY` - Sandbox key ⚠️ **PENTING: Harus berbeda**
- `FRONTEND_URL` - Preview URL ⚠️ Set setelah Francis deploy

### Step 4: Variable yang Bisa Sama

Kebanyakan variable lainnya bisa menggunakan nilai yang sama untuk Preview dan Production:
- Database, Redis, Firebase, AWS credentials, dll

**Catatan**: Untuk testing, bisa pakai database/Redis terpisah untuk Preview, tapi tidak wajib.

---

## ✅ Verifikasi Deployment

### Step 1: Push ke GitHub

```bash
git add .
git commit -m "Add Vercel CI/CD workflows"
git push origin main  # atau branch lain untuk test preview
```

### Step 2: Cek GitHub Actions

1. Buka repository GitHub
2. Pergi ke tab **Actions**
3. Cek workflow **"Vercel Production Deployment"** (untuk branch `main`) atau **"Vercel Preview Deployment"** (untuk branch lain)
4. Pastikan workflow berjalan tanpa error

### Step 3: Cek Vercel Dashboard

1. Buka Vercel Dashboard
2. Buka project **Galton**
3. Pergi ke tab **Deployments**
4. Pastikan deployment berhasil
5. Klik deployment untuk melihat logs jika ada error

### Step 4: Test API

Setelah deploy berhasil, dapat URL seperti:
- Production: `https://galton.vercel.app` (atau sesuai project name)
- Preview: `https://galton-git-dev-[username].vercel.app`

Test endpoint:
```bash
# Health check
curl https://galton.vercel.app/api

# API endpoint
curl https://galton.vercel.app/api/users
```

---

## 🐛 Troubleshooting

### Error: Missing VERCEL_TOKEN

**Penyebab**: Secret `VERCEL_TOKEN` belum di-set di GitHub atau token sudah expired.

**Solusi**:
1. Cek GitHub Secrets sudah benar
2. Buat token baru di Vercel jika perlu
3. Update secret di GitHub

### Error: Build Failed

**Penyebab**: 
- Dependencies tidak terinstall
- Build command error
- Missing environment variables

**Solusi**:
1. Cek logs di Vercel Dashboard → Deployments → [deployment] → Build Logs
2. Pastikan `package.json` dan `pnpm-lock.yaml` sudah di-commit
3. Pastikan semua required environment variables sudah di-set

### Error: CORS Error

**Penyebab**: `FRONTEND_URL` belum di-set atau tidak sesuai dengan URL Francis.

**Solusi**:
1. Pastikan `FRONTEND_URL` sudah di-set di Vercel
2. Pastikan URL sesuai dengan URL Francis di Vercel
3. Redeploy setelah update environment variables

### Error: Database Connection Failed

**Penyebab**: 
- `DATABASE_URL` belum di-set atau salah
- Database tidak accessible dari Vercel

**Solusi**:
1. Pastikan `DATABASE_URL` sudah di-set di Vercel
2. Pastikan database allow connection dari Vercel IP (jika menggunakan firewall)
3. Untuk database seperti Supabase/Neon, biasanya sudah allow semua IP

### Error: Redis Connection Failed

**Penyebab**: 
- `REDIS_URL` atau `CACHE_URL` belum di-set atau salah
- Redis tidak accessible dari Vercel

**Solusi**:
1. Pastikan `REDIS_URL` dan `CACHE_URL` sudah di-set di Vercel
2. Pastikan Redis allow connection dari Vercel IP
3. Gunakan Redis service seperti Upstash yang sudah compatible dengan Vercel

### Workflow Tidak Berjalan

**Penyebab**: 
- Workflow file tidak ada atau salah path
- Branch tidak trigger workflow

**Solusi**:
1. Pastikan file workflow ada di `.github/workflows/`
2. Pastikan branch sesuai dengan trigger di workflow (main untuk production, branch lain untuk preview)
3. Cek GitHub Actions tab untuk melihat error

---

## 📚 Referensi

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [GitHub Actions](https://docs.github.com/en/actions)
- [NestJS Deployment](https://docs.nestjs.com/recipes/serverless)

---

## ✅ Checklist Setup

- [ ] Vercel project sudah dibuat
- [ ] GitHub secrets sudah di-set (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
- [ ] GitHub environment `github-actions` sudah dibuat
- [ ] Environment variables sudah di-set di Vercel (cek `VERCEL_ENV_VARIABLES.md`)
- [ ] Workflow files sudah di-commit dan push
- [ ] Deployment berhasil di Vercel
- [ ] API bisa diakses dan berfungsi dengan benar
- [ ] CORS sudah dikonfigurasi dengan benar

---

**Selamat deploy! 🚀**

Jika ada pertanyaan atau masalah, cek logs di Vercel Dashboard atau GitHub Actions.
