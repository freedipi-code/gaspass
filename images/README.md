# Images locales

Dépose ici les photos de tes produits et de la boutique.

## Utilisation

Dans Prisma Studio (ou n'importe où dans la base), pour le champ `image` d'un produit :

```
images/basmati5.jpg
```

Le bot résout automatiquement vers le fichier `images/basmati5.jpg` du projet.

## Formats supportés

`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

## Bonnes pratiques

- **Taille** : 600×400 ou 800×600 pixels suffisent largement pour Telegram
- **Poids** : compresse à <500 Ko par image pour des envois rapides
- **Nommage** : minuscules, pas d'espaces, ex. `basmati-premium-5kg.jpg`

## Tu peux aussi mettre une URL

Si tu préfères héberger ailleurs (Imgur, ton CDN, etc.), mets l'URL complète à la place :

```
https://example.com/basmati.jpg
```

Le bot détecte automatiquement le format URL et l'utilise directement.
