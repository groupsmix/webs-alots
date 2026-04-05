# 🚀 One-Click Setup Guide

**Automated setup for Supabase + Cloudflare + AI Revenue Agent**

---

## 🎯 Quick Start

### Windows (PowerShell)
```powershell
.\setup.ps1
```

### Mac/Linux (Bash)
```bash
chmod +x setup.sh
./setup.sh
```

---

## 📋 What the Script Does

### 1. ✅ Checks Prerequisites
- Node.js installed
- npm installed
- Git installed

### 2. 📦 Installs Dependencies
- All npm packages
- Supabase CLI
- Wrangler (Cloudflare CLI)

### 3. 🔧 Configures Environment
- Creates `.env.local` from template
- Prompts for credentials
- Validates configuration

### 4. 🗄️ Sets Up Supabase
- Links to existing project OR
- Guides you to create new project
- Runs all 5 database migrations
- Sets up RLS policies

### 5. ☁️ Sets Up Cloudflare
- Authenticates with Cloudflare
- Creates Pages project
- Configures wrangler.toml
- Sets up environment variables

### 6. 🔨 Builds Application
- Runs production build
- Optimizes assets
- Prepares for deployment

---

## 🔑 Required Credentials

Before running the script, have these ready:

### Supabase
- Project URL: `https://xxx.supabase.co`
- Anon Key: `eyJhbGc...`
- Service Role Key: `eyJhbGc...`

**Get from:** https://supabase.com/dashboard → Your Project → Settings → API

### OpenAI or Anthropic
- OpenAI API Key: `sk-...`
- OR Anthropic API Key: `sk-ant-...`

**Get from:** 
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

### Twilio (WhatsApp/SMS)
- Account SID: `AC...`
- Auth Token: `...`
- WhatsApp Number: `+212...`

**Get from:** https://console.twilio.com/

### Resend (Email)
- API Key: `re_...`

**Get from:** https://resend.com/api-keys

### Cloudflare
- Account (free tier works)

**Sign up:** https://dash.cloudflare.com/sign-up

---

## 🎬 Step-by-Step

### Step 1: Run Setup Script

**Windows:**
```powershell
.\setup.ps1
```

**Mac/Linux:**
```bash
./setup.sh
```

### Step 2: Follow Prompts

The script will ask you:

1. **Use existing Supabase project?**
   - `y` = Enter your credentials
   - `n` = Script opens Supabase dashboard for you to create one

2. **Run migrations now?**
   - `y` = Automatically runs all 5 migrations
   - `n` = You can run later with `supabase db push`

3. **Have Cloudflare account?**
   - `y` = Authenticates and configures
   - `n` = Opens Cloudflare signup page

4. **Project name?**
   - Enter your desired name (e.g., `oltigo-health`)

### Step 3: Verify Setup

After script completes:

```bash
# Test locally
npm run dev

# Open http://localhost:3000
```

### Step 4: Deploy

```bash
# Deploy to Cloudflare
npm run deploy
```

---

## 🔧 Manual Setup (If Script Fails)

### 1. Install Dependencies
```bash
npm install
npm install -g supabase wrangler
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

### 3. Setup Supabase
```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### 4. Setup Cloudflare
```bash
# Login
wrangler login

# Create wrangler.toml (see template below)
```

### 5. Build & Deploy
```bash
npm run build
npm run deploy
```

---

## 📝 wrangler.toml Template

```toml
name = "your-project-name"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".vercel/output/static"

[env.production]
vars = { NODE_ENV = "production" }

[env.preview]
vars = { NODE_ENV = "preview" }
```

---

## 🐛 Troubleshooting

### "Command not found: supabase"
```bash
npm install -g supabase
```

### "Command not found: wrangler"
```bash
npm install -g wrangler
```

### "Permission denied: ./setup.sh"
```bash
chmod +x setup.sh
```

### "Migrations failed"
```bash
# Check Supabase connection
supabase status

# Try manual push
supabase db push
```

### "Cloudflare authentication failed"
```bash
# Re-authenticate
wrangler logout
wrangler login
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `.env.local` exists with all variables
- [ ] `npm run dev` starts successfully
- [ ] Can access http://localhost:3000
- [ ] Database tables exist (check Supabase dashboard)
- [ ] Cloudflare project created
- [ ] Build completes without errors

---

## 🚀 Next Steps

1. **Test Locally**
   ```bash
   npm run dev
   ```

2. **Run Tests**
   ```bash
   npm run test
   ```

3. **Deploy to Production**
   ```bash
   npm run deploy
   ```

4. **Configure AI Agent**
   - Navigate to `/admin/ai`
   - Enable AI agent
   - Set business goals
   - Configure approval thresholds

5. **Monitor**
   - Check `/api/health` endpoint
   - Monitor Sentry for errors
   - Review action logs

---

## 📚 Additional Resources

- **Setup Guide:** `AI_SETUP_GUIDE.md`
- **Deployment:** `DEPLOY_CHECKLIST_FINAL.md`
- **Quick Reference:** `AI_QUICK_REFERENCE.md`
- **Troubleshooting:** `MY_HONEST_ASSESSMENT.md`

---

## 🎉 Success!

Once setup is complete, you'll have:

✅ Supabase database with all tables  
✅ Cloudflare Pages project  
✅ AI Revenue Agent configured  
✅ All environment variables set  
✅ Ready to deploy  

**Total Setup Time:** 10-15 minutes

**Your AI Revenue Agent is ready to generate revenue!** 🚀
