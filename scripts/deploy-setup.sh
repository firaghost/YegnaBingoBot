#!/bin/bash

# Bingo Vault - Vercel Deployment Setup Script
# This script helps you set up environment variables before deployment

echo "🎮 Bingo Vault - Vercel Deployment Setup"
echo "=========================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "✅ Vercel CLI is ready"
echo ""

# Login to Vercel
echo "📝 Logging in to Vercel..."
vercel login

echo ""
echo "🔗 Linking project to Vercel..."
vercel link

echo ""
echo "📋 Now let's add your environment variables"
echo ""

# BOT_TOKEN
echo "1️⃣ BOT_TOKEN"
echo "Enter your Telegram Bot Token:"
vercel env add BOT_TOKEN

echo ""

# SUPABASE_URL
echo "2️⃣ SUPABASE_URL"
echo "Enter your Supabase Project URL (e.g., https://xxxxx.supabase.co):"
vercel env add SUPABASE_URL

echo ""

# SUPABASE_KEY
echo "3️⃣ SUPABASE_KEY"
echo "Enter your Supabase Service Role Key:"
vercel env add SUPABASE_KEY

echo ""

# ADMIN_PASSWORD
echo "4️⃣ ADMIN_PASSWORD"
echo "Enter your Admin Dashboard Password:"
vercel env add ADMIN_PASSWORD

echo ""

# NEXT_PUBLIC_SUPABASE_URL
echo "5️⃣ NEXT_PUBLIC_SUPABASE_URL"
echo "Enter your Supabase URL again (for Next.js):"
vercel env add NEXT_PUBLIC_SUPABASE_URL

echo ""

# NEXT_PUBLIC_SUPABASE_ANON_KEY
echo "6️⃣ NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "Enter your Supabase Anon/Public Key:"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

echo ""
echo "✅ All environment variables added!"
echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "Run: vercel --prod"
echo ""
