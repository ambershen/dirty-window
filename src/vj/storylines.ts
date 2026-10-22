/**
 * Storylines a drawing agent can compose a scroll from. A storyline is not a script: it names the
 * cast, the places and the episodes that belong to the story, with how each episode feels (so the
 * music can call for it: a breakdown wants a quiet one, a drop a climax). The agent chooses which
 * episodes to tell, in what order, how to stage each one from the motifs (see motifSketches.ts),
 * and how to carry the ground, the river or the sea from one scene into the next.
 */
export type Mood = 'quiet' | 'journey' | 'busy' | 'climax'
export type Episode = { id: string; title: string; mood: Mood; scene: string; cast: string[]; places: string[] }
export type Storyline = { id: string; title: string; ground: 'sea' | 'land' | 'both'; tone: string; episodes: Episode[] }

export const STORYLINES: Storyline[] = [
  {
    id: 'odyssey', title: 'The Odyssey', ground: 'both',
    tone: 'Drawn as a Greek vase painter would: bold silhouettes in profile, the sea as a running wave scroll, ships long and low with eyes on their prows.',
    episodes: [
      { id: 'setsail', title: 'Setting sail from Troy', mood: 'journey', scene: 'A long ship with its oars out leaves a burning city behind.', cast: ['odysseus', 'crew'], places: ['ship', 'sea', 'city'] },
      { id: 'cyclops', title: 'The Cyclops', mood: 'climax', scene: 'In a cave the one-eyed giant is blinded with a stake; the men escape clinging under his rams.', cast: ['polyphemus', 'odysseus', 'ram'], places: ['cave', 'rocks'] },
      { id: 'winds', title: 'The bag of winds', mood: 'busy', scene: 'The crew open the bag; the winds burst out and drive the ship back.', cast: ['crew', 'winds'], places: ['ship', 'sea', 'clouds'] },
      { id: 'circe', title: 'Circe', mood: 'busy', scene: 'The enchantress turns the crew into swine at her palace among the trees.', cast: ['circe', 'swine'], places: ['palace', 'trees'] },
      { id: 'sirens', title: 'The Sirens', mood: 'climax', scene: 'Odysseus is tied to the mast; bird-women sing from the rocks; the crew row on, ears stopped.', cast: ['odysseus', 'sirens', 'crew'], places: ['ship', 'rocks', 'sea'] },
      { id: 'scylla', title: 'Scylla and Charybdis', mood: 'climax', scene: 'A many-headed monster reaches from a cliff while a whirlpool turns on the other side.', cast: ['scylla'], places: ['cliff', 'whirlpool', 'ship'] },
      { id: 'calypso', title: 'Calypso\'s island', mood: 'quiet', scene: 'Years pass on a quiet island; he builds a raft beneath the trees.', cast: ['odysseus', 'calypso'], places: ['island', 'trees', 'raft'] },
      { id: 'storm', title: 'Shipwreck', mood: 'climax', scene: 'Poseidon\'s storm breaks the raft; dolphins and waves everywhere.', cast: ['poseidon', 'dolphins'], places: ['sea', 'waves'] },
      { id: 'ithaca', title: 'Home to Ithaca', mood: 'quiet', scene: 'He lands under an olive tree; his old dog knows him; Penelope at her loom.', cast: ['odysseus', 'dog', 'penelope'], places: ['olive', 'house', 'loom'] },
      { id: 'bow', title: 'The bow', mood: 'climax', scene: 'He strings the great bow and shoots through the line of axe heads.', cast: ['odysseus', 'suitors'], places: ['hall'] },
    ],
  },
  {
    id: 'xiyou', title: 'Journey to the West', ground: 'land',
    tone: 'Drawn as a Ming woodblock illustration: figures on a winding mountain road, clouds in curls, pines on the rocks.',
    episodes: [
      { id: 'stone', title: 'Born from a stone', mood: 'quiet', scene: 'On a mountain top a stone egg cracks and a monkey steps out, bowing to the four directions.', cast: ['wukong'], places: ['peaks', 'clouds'] },
      { id: 'heaven', title: 'Havoc in Heaven', mood: 'climax', scene: 'The Monkey King leaps on his cloud and fights the heavenly army with his staff.', cast: ['wukong', 'soldiers'], places: ['clouds', 'palace'] },
      { id: 'mountain', title: 'Under the mountain', mood: 'quiet', scene: 'Pinned under the Five Elements Mountain for five hundred years, only his head free.', cast: ['wukong'], places: ['peaks'] },
      { id: 'setout', title: 'Setting out', mood: 'journey', scene: 'The monk on his white horse, the monkey ahead with the staff, the pig and the sand monk carrying the load.', cast: ['tang', 'wukong', 'bajie', 'wujing', 'horse'], places: ['road', 'pine', 'peaks'] },
      { id: 'river', title: 'The Flowing Sand River', mood: 'busy', scene: 'They meet Sha Wujing at a wide river and cross it on a raft of a gourd.', cast: ['wujing', 'tang', 'wukong'], places: ['river', 'raft'] },
      { id: 'bonedemon', title: 'The White Bone Demon', mood: 'climax', scene: 'A demon takes three disguises; the monkey sees through each and strikes.', cast: ['wukong', 'demon', 'tang'], places: ['peaks', 'clouds'] },
      { id: 'flame', title: 'The Flaming Mountains', mood: 'climax', scene: 'A wall of fire; the monkey fans it out with the palm-leaf fan.', cast: ['wukong', 'fan'], places: ['flames', 'peaks'] },
      { id: 'rest', title: 'A night on the road', mood: 'quiet', scene: 'The four rest under a pine by moonlight; the horse grazes.', cast: ['tang', 'wukong', 'bajie', 'wujing', 'horse'], places: ['pine', 'moon'] },
      { id: 'west', title: 'Arriving in the West', mood: 'journey', scene: 'A temple on the clouds; the scriptures, and the long road behind them.', cast: ['tang', 'wukong', 'bajie', 'wujing'], places: ['temple', 'clouds'] },
    ],
  },
]
