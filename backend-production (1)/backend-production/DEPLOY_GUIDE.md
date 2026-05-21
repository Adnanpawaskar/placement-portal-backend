# 🚀 Render Pe Deploy Karo — Step by Step

## Step 1: MongoDB Atlas Setup
1. atlas.mongodb.com login karo
2. Network Access → Add IP Address → "Allow Access from Anywhere" (0.0.0.0/0)
3. Database Access → apna user check karo password yaad hai?

## Step 2: Gmail App Password
1. myaccount.google.com → Security → 2-Step Verification ON karo
2. App Passwords → naam do "Render" → Generate karo
3. 16-char password copy karo

## Step 3: GitHub pe push karo
```bash
git init
git add .
git commit -m "production ready"
git branch -M main
git remote add origin https://github.com/TERA_USERNAME/placement-backend.git
git push -u origin main
```

## Step 4: Render pe deploy
1. render.com → Sign up (GitHub se)
2. New + → Web Service → GitHub repo select karo
3. Settings:
   - Build Command: npm install
   - Start Command: npm start

## Step 5: Environment Variables Render pe daalo
(Dashboard → Environment tab)

| Variable | Value |
|----------|-------|
| MONGO_URI | mongodb+srv://adnanpawaskar163_db_user:PASSWORD@cluster0.fc2hx2t.mongodb.net/placement_portal?appName=Cluster0 |
| JWT_SECRET | koi bhi strong random string |
| JWT_EXPIRE | 7d |
| EMAIL_HOST | smtp.gmail.com |
| EMAIL_PORT | 587 |
| EMAIL_USER | adnanpawaskar163@gmail.com |
| EMAIL_PASS | naya app password yahan |
| CLIENT_URL | https://tera-netlify-app.netlify.app |
| ADMIN_EMAIL | adnanpawaskar163@gmail.com |
| PORTAL_NAME | Placement Portal |
| NODE_ENV | production |

## Step 6: Frontend mein API URL update karo
Netlify pe ya code mein jahan bhi localhost:5000 hai use Render URL se replace karo:
https://placement-portal-backend.onrender.com

## ⚠️ Free Tier Note
Render free mein 15 min baad sleep ho jaata hai.
Solution: uptimerobot.com pe free account banao, har 10 min ping lagao.
