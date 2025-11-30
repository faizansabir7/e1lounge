# 🚀 Quick Start - Deploy in 5 Minutes!

## What You Need:
- GitHub account
- Render account (free, sign up with GitHub)

---

## Step 1: Push to GitHub (2 minutes)

```bash
# If you haven't already initialized git:
git init
git add .
git commit -m "Ready for deployment"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Render (3 minutes)

1. Go to: https://dashboard.render.com/
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `library-inventory`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: Free
5. Click "Create Web Service"

---

## That's It! ✅

Wait 2-3 minutes for deployment, then access your app at:
`https://your-app-name.onrender.com`

**Login:** admin / admin123

**Features Working:**
- ✅ HTTPS (for camera access)
- ✅ Barcode scanning
- ✅ CSV storage for books & transactions
- ✅ Mobile-friendly interface

**Note:** Free tier sleeps after 15 mins inactivity (wakes in ~30 seconds)

---

## Need Help?
See `DEPLOYMENT_GUIDE.md` for detailed instructions!
