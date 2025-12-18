#!/bin/bash

echo "🔍 Vérification de l'installation..."
echo ""

# Vérifier Node.js
if command -v node &> /dev/null
then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installé: $NODE_VERSION"
else
    echo "❌ Node.js n'est pas installé"
    echo "   Téléchargez-le sur: https://nodejs.org"
    exit 1
fi

# Vérifier npm
if command -v npm &> /dev/null
then
    NPM_VERSION=$(npm --version)
    echo "✅ npm installé: $NPM_VERSION"
else
    echo "❌ npm n'est pas installé"
    exit 1
fi

echo ""
echo "📦 Installation des dépendances..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation réussie!"
    echo ""
    echo "🚀 Pour lancer l'application:"
    echo "   npm run dev"
    echo ""
    echo "📦 Pour compiler:"
    echo "   npm run build"
else
    echo ""
    echo "❌ Erreur lors de l'installation"
    echo "   Essayez: npm cache clean --force && npm install"
fi
