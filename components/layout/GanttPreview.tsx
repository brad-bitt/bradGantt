/**
 * Miniature décorative du produit, pour la page de connexion.
 *
 * Purement statique et `aria-hidden` : c'est une image, pas un diagramme consultable. Elle
 * n'existe que pour répondre à la question qu'un formulaire seul laissait ouverte — à quoi
 * ressemble ce qu'on va trouver de l'autre côté.
 *
 * Les couleurs viennent du registre DONNÉES de la charte, jamais du jaune (réservé à l'état
 * actif) : la miniature doit ressembler à un vrai projet, pas à une décoration inventée.
 */
const BARS = [
  { label: 'Cadrage', color: '#5B9DFF', left: 0, width: 24, progress: 100 },
  { label: 'Maquettes', color: '#FF8A3D', left: 27, width: 24, progress: 65 },
  { label: 'Développement', color: '#FF6FA3', left: 54, width: 26, progress: 25 },
  { label: 'Recette', color: '#3ECF8E', left: 83, width: 13, progress: 0 },
]

const ROW_H = 34
const BAR_H = 22
/** Milieu vertical de la barre de la ligne `i` : c'est par là qu'entrent et sortent les liens. */
const centerY = (i: number) => i * ROW_H + 6 + BAR_H / 2
/** Décrochement horizontal d'un lien, en pixels, comme les flèches du vrai diagramme. */
const STUB = 6

export function GanttPreview() {
  return (
    <div aria-hidden className="bg-paper brutal shadow-brutal-lg select-none">
      <div className="flex items-center justify-between border-b-[3px] border-ink bg-header px-3 py-1.5 text-on-header">
        <span className="font-display text-xs uppercase">Refonte du site</span>
        <span className="font-mono text-[10px] opacity-70">SEPT — DÉC</span>
      </div>

      {/* Piste interne : toutes les abscisses en pourcentage se mesurent SUR ELLE et non sur le
          cadre. Posées sur le cadre, elles s'ajoutaient à la marge intérieure et la dernière
          barre débordait du panneau par la droite. */}
      <div className="relative m-3" style={{ height: BARS.length * ROW_H }}>
        {/* Colonnes de mois : le rythme de fond, en retrait, comme dans l'application. */}
        <div className="absolute inset-0 flex">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i % 2 === 1 ? 'flex-1 bg-band' : 'flex-1'} />
          ))}
        </div>

        {/* Trait du jour : le seul rouge de la miniature, comme dans le produit. */}
        <span className="absolute inset-y-0 w-[3px] bg-today" style={{ left: '38%' }} />

        {/* Liens fin → début, en équerre : c'est l'argument « enchaîné » rendu visible. */}
        {BARS.slice(0, -1).map((bar, i) => {
          const from = bar.left + bar.width
          const to = BARS[i + 1].left
          return (
            <span key={`link-${bar.label}`}>
              <span
                className="absolute w-[3px] bg-ink"
                style={{ left: `calc(${from}% + ${STUB}px)`, top: centerY(i), height: ROW_H }}
              />
              <span
                className="absolute h-[3px] bg-ink"
                style={{ left: `calc(${from}% + ${STUB}px)`, top: centerY(i + 1), width: `calc(${to - from}% - ${STUB}px)` }}
              />
            </span>
          )
        })}

        {BARS.map((bar, i) => (
          <div
            key={bar.label}
            className="absolute flex items-center border-[3px] border-ink shadow-brutal"
            style={{
              top: i * ROW_H + 6,
              left: `${bar.left}%`,
              width: `${bar.width}%`,
              height: BAR_H,
              backgroundColor: bar.color,
            }}
          >
            <span
              className="absolute inset-y-0 left-0 hatch-data opacity-25"
              style={{ width: `${bar.progress}%` }}
            />
            <span className="relative truncate px-1.5 text-[10px] font-bold text-on-data">{bar.label}</span>
          </div>
        ))}

        {/* Jalon de clôture : le losange du produit, posé après la dernière barre. */}
        <span
          className="absolute size-3 rotate-45 border-[3px] border-ink bg-violet"
          style={{ top: centerY(BARS.length - 1) - 6, left: 'calc(100% - 12px)' }}
        />
      </div>
    </div>
  )
}
