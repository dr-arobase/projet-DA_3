# Contexte de design — CrimeTracker

Ces cinq fichiers décrivent ce qu'il faut savoir avant de concevoir ou de modifier un écran de CrimeTracker. On les donne en entier à un designer, à un coéquipier ou à Claude au début de chaque travail d'interface, pour ne pas réexpliquer le projet à chaque fois.

| Fichier | Contenu |
|---|---|
| [01-identite.md](01-identite.md) | Ce qu'est CrimeTracker, pour qui, ce qui n'est pas négociable |
| [02-voix.md](02-voix.md) | Comment l'interface parle : ton, vocabulaire, messages d'erreur |
| [03-marque-visuelle.md](03-marque-visuelle.md) | Couleurs, polices, mise en page et composants réellement utilisés dans le code |
| [04-public.md](04-public.md) | Les trois profils d'agents, leur contexte de travail et ce qui les gêne |
| [05-anti-ia.md](05-anti-ia.md) | Ce qu'il faut éviter : clichés visuels, formules creuses, fausses données |

## Comment s'en servir

1. Donner les cinq fichiers, puis la tâche : l'écran, le rôle concerné, ce qui doit être possible.
2. Demander d'abord un résumé de la tâche et des contraintes, avant tout dessin. Si le résumé est faux, le design le sera aussi.
3. Demander plusieurs directions, les critiquer avec les critères de ces fichiers, puis en affiner une seule.
4. Finir par des notes de passage pour la personne qui code l'écran.

Quand le code change (une nouvelle couleur, un nouveau composant), on met à jour `03-marque-visuelle.md` dans la même PR.
