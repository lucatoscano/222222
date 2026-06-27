# Particle Morph

Nuvola di particelle Three.js che esegue il morph ciclico fra modelli OBJ.

## Aggiungere una forma

Metti gli OBJ in `public/models` con nomi numerici consecutivi:

```text
1.obj
2.obj
3.obj
...
```

L'app li rileva automaticamente all'avvio. Ogni modello viene centrato,
normalizzato, campionato sulla superficie e ordinato spazialmente prima del
morph.

## Controlli

- Trascina per ruotare la scena.
- Premi `spazio` per passare subito alla forma successiva.
- Il ciclo parte automaticamente dopo una breve pausa.

## Regolazioni principali

Le costanti all'inizio di `src/main.js` controllano il numero di particelle,
la durata del morph e la pausa fra le forme. La turbolenza e la dimensione dei
punti sono in `src/ParticleCloud.js`.

[Apri in StackBlitz](https://stackblitz.com/~/github.com/lucatoscano/vitejs-vite-kyyqwmtu)
