# 🚀 GitHub Pages Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Initial TruthLens deployment"
git push origin main
```

### Step 2: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **GitHub Actions**
5. Save the settings

### Step 3: Deploy Backend to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **New Project**
4. Import your repository
5. Vercel will auto-detect the API configuration
6. Click **Deploy**

### Step 4: Update Frontend Backend URL
1. In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**
2. Add a new repository secret:
   - Name: `VERCEL_URL`
   - Value: Your Vercel app URL (e.g., `https://truthlens-api.vercel.app`)

## 🎯 Your App Will Be Live At:
- **Frontend**: `https://your-username.github.io/truthlens`
- **Backend**: `https://your-vercel-app.vercel.app/api`

## 🔧 Configuration Details

### Frontend (GitHub Pages)
- **Framework**: React with Tailwind CSS
- **Build**: Automated via GitHub Actions
- **Deployment**: Every push to main branch
- **Domain**: `your-username.github.io/truthlens`

### Backend (Vercel)
- **Framework**: FastAPI (Python)
- **Database**: MongoDB Atlas (pre-configured)
- **AI**: Google Gemini API (pre-configured)
- **Deployment**: Serverless functions

## 📱 Features Included
- ✅ User Authentication
- ✅ Text Analysis
- ✅ URL Credibility Check
- ✅ Image Analysis
- ✅ Educational Content
- ✅ Responsive Design

## 🛠️ Troubleshooting

### If GitHub Pages doesn't deploy:
1. Check the **Actions** tab for build errors
2. Ensure GitHub Pages is enabled in Settings
3. Verify the workflow file is in `.github/workflows/`

### If Vercel deployment fails:
1. Check the Vercel dashboard for error logs
2. Ensure `vercel.json` is in the root directory
3. Verify the API folder structure

### If frontend can't connect to backend:
1. Update the `REACT_APP_BACKEND_URL` in the GitHub Actions workflow
2. Check CORS settings in the backend
3. Verify the Vercel URL is correct

## 🎉 Success!
Your TruthLens app is now live and ready to help users detect misinformation!

## 📞 Support
- Check GitHub Actions logs for deployment issues
- Check Vercel dashboard for API issues
- Verify all environment variables are set correctly
