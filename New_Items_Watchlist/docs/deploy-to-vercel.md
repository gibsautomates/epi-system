# Deploy to Vercel (Recommended)

## Steps to Deploy:

1. **Install Vercel CLI** (if not already installed):
```bash
npm i -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

4. **Set Environment Variables** in Vercel Dashboard:
- Go to your project settings
- Add these environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL` = your_supabase_url
  - `SUPABASE_SERVICE_ROLE_KEY` = your_service_key

5. **Deploy to Production**:
```bash
vercel --prod
```

Your app will be available at:
- Preview: `https://your-project-name.vercel.app`
- Custom domain: You can add your own domain in Vercel settings

## Alternative Quick Deploy:

1. Push your code to GitHub
2. Go to https://vercel.com
3. Import your GitHub repository
4. Add environment variables
5. Deploy!

The app will auto-deploy on every git push.