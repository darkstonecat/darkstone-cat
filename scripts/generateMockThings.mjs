// scripts/generateMockThings.mjs
// Genera un things.xml mock con la estructura real de BGG a partir del collection.xml
// Extrae todos los datos disponibles del collection.xml y añade datos curados
// (mecánicas, categorías, peso, edad mínima, descripción) para cada juego.

import fs from 'fs'

// ─── Knowledge base: mecánicas reales de BGG ────────────────────────────────
const MECHANIC = {
  actionPoints:       { id: '2001', name: 'Action Points' },
  actionQueue:        { id: '2689', name: 'Action Queue' },
  actionRetrieval:    { id: '2839', name: 'Action Retrieval' },
  areaMajority:       { id: '2080', name: 'Area Majority / Influence' },
  areaMovement:       { id: '2046', name: 'Area Movement' },
  asymmetric:         { id: '2885', name: 'Asymmetric' },
  auction:            { id: '2012', name: 'Auction / Bidding' },
  betting:            { id: '2014', name: 'Betting and Bluffing' },
  cardDrafting:       { id: '2043', name: 'Card Drafting' },
  cardPlayConflict:   { id: '2041', name: 'Card Play Conflict Resolution' },
  closedDrafting:     { id: '2891', name: 'Closed Drafting' },
  cooperative:        { id: '2023', name: 'Cooperative Game' },
  deckBagPool:        { id: '2664', name: 'Deck, Bag, and Pool Building' },
  diceRolling:        { id: '2072', name: 'Dice Rolling' },
  drafting:           { id: '2676', name: 'Drafting' },
  endGameBonuses:     { id: '2856', name: 'End Game Bonuses' },
  engineBuilding:     { id: '2897', name: 'Engine Building' },
  events:             { id: '2831', name: 'Events' },
  followSuit:         { id: '2924', name: 'Follow' },
  gridMovement:       { id: '2676', name: 'Grid Movement' },
  handManagement:     { id: '2040', name: 'Hand Management' },
  hexGrid:            { id: '2026', name: 'Hexagonal Grid' },
  hidden:             { id: '2028', name: 'Hidden Roles' },
  income:             { id: '2850', name: 'Income' },
  mapAddition:        { id: '2902', name: 'Map Addition' },
  memory:             { id: '2047', name: 'Memory' },
  modularBoard:       { id: '2011', name: 'Modular Board' },
  moveThrough:        { id: '2078', name: 'Point to Point Movement' },
  negotiation:        { id: '2019', name: 'Negotiation' },
  networkRoute:       { id: '2081', name: 'Network and Route Building' },
  openDrafting:       { id: '2984', name: 'Open Drafting' },
  patternBuilding:    { id: '2048', name: 'Pattern Building' },
  pickUpDeliver:      { id: '2007', name: 'Pick-up and Deliver' },
  playerElimination:  { id: '2685', name: 'Player Elimination' },
  pushYourLuck:       { id: '2661', name: 'Push Your Luck' },
  raceCondition:      { id: '2876', name: 'Race' },
  roleSelection:      { id: '2028', name: 'Role Playing' },
  rollWrite:          { id: '2877', name: 'Roll-and-Write' },
  setCollection:      { id: '2004', name: 'Set Collection' },
  simultaneous:       { id: '2020', name: 'Simultaneous Action Selection' },
  solo:               { id: '2814', name: 'Solo / Solitaire Game' },
  storytelling:       { id: '2027', name: 'Storytelling' },
  takeThat:           { id: '2686', name: 'Take That' },
  tilePlacement:      { id: '2002', name: 'Tile Placement' },
  trading:            { id: '2008', name: 'Trading' },
  trickTaking:        { id: '2009', name: 'Trick-taking' },
  variableOrder:      { id: '2079', name: 'Variable Phase Order' },
  variablePlayerPow:  { id: '2015', name: 'Variable Player Powers' },
  voting:             { id: '2017', name: 'Voting' },
  workerPlacement:    { id: '2082', name: 'Worker Placement' },
  dexterity:          { id: '2060', name: 'Physical Dexterity' },
  stacking:           { id: '2917', name: 'Stacking and Balancing' },
  communication:      { id: '2893', name: 'Communication Limits' },
  programmedMovement: { id: '2822', name: 'Programmed Movement' },
  commodity:          { id: '2903', name: 'Commodity Speculation' },
  rondel:             { id: '2831', name: 'Rondel' },
  contracts:          { id: '2932', name: 'Contracts' },
  multiUseCards:      { id: '2912', name: 'Multi-Use Cards' },
}

const CATEGORY = {
  abstract:     { id: '1009', name: 'Abstract Strategy' },
  adventure:    { id: '1022', name: 'Adventure' },
  ancient:      { id: '1050', name: 'Ancient' },
  animals:      { id: '1089', name: 'Animals' },
  aviation:     { id: '1052', name: 'Aviation / Flight' },
  bluffing:     { id: '1023', name: 'Bluffing' },
  cardGame:     { id: '1002', name: 'Card Game' },
  children:     { id: '1041', name: "Children's Game" },
  cityBuilding: { id: '1029', name: 'City Building' },
  civilization: { id: '1015', name: 'Civilization' },
  collectComp:  { id: '1044', name: 'Collectible Components' },
  deduction:    { id: '1039', name: 'Deduction' },
  diceGame:     { id: '1017', name: 'Dice' },
  economic:     { id: '1021', name: 'Economic' },
  environmental:{ id: '1084', name: 'Environmental' },
  exploration:  { id: '1020', name: 'Exploration' },
  fantasy:      { id: '1010', name: 'Fantasy' },
  farming:      { id: '1013', name: 'Farming' },
  fighting:     { id: '1046', name: 'Fighting' },
  horror:       { id: '1024', name: 'Horror' },
  humor:        { id: '1079', name: 'Humor' },
  industry:     { id: '1088', name: 'Industry / Manufacturing' },
  math:         { id: '1104', name: 'Math' },
  medieval:     { id: '1035', name: 'Medieval' },
  memory:       { id: '1045', name: 'Memory' },
  miniatures:   { id: '1047', name: 'Miniatures' },
  movies:       { id: '1064', name: 'Movies / TV / Radio Theme' },
  murder:       { id: '1040', name: 'Murder / Mystery' },
  nautical:     { id: '1008', name: 'Nautical' },
  negotiation:  { id: '1026', name: 'Negotiation' },
  number:       { id: '1098', name: 'Number' },
  party:        { id: '1030', name: 'Party Game' },
  political:    { id: '1001', name: 'Political' },
  puzzle:       { id: '1028', name: 'Puzzle' },
  racing:       { id: '1031', name: 'Racing' },
  realTime:     { id: '1037', name: 'Real-time' },
  sciFi:        { id: '1016', name: 'Science Fiction' },
  space:        { id: '1113', name: 'Space Exploration' },
  spies:        { id: '1081', name: 'Spies / Secret Agents' },
  territory:    { id: '1086', name: 'Territory Building' },
  trains:       { id: '1034', name: 'Trains' },
  transportation: { id: '1011', name: 'Transportation' },
  travel:       { id: '1097', name: 'Travel' },
  wargame:      { id: '1019', name: 'Wargame' },
  wordGame:     { id: '1025', name: 'Word Game' },
}

// ─── Datos curados por juego ────────────────────────────────────────────────
// Cada juego tiene: weight, minage, mechanics[], categories[], description
// Los datos de weight y minage intentan replicar los valores reales de BGG.
const GAME_DATA = {
  367280: { // 1998 ISS
    weight: 2.82, minage: 12,
    mechanics: ['handManagement', 'engineBuilding', 'setCollection', 'solo'],
    categories: ['sciFi', 'space'],
    description: 'In 1998 ISS, players work as space agencies cooperating and competing to build the International Space Station. Manage your hand of project cards, allocate resources, and contribute modules to the station while advancing your own national interests in the race for space.',
  },
  371947: { // 3 Ring Circus
    weight: 2.53, minage: 10,
    mechanics: ['workerPlacement', 'setCollection', 'endGameBonuses', 'openDrafting'],
    categories: ['animals'],
    description: 'Step into the world of traveling circuses in 3 Ring Circus! As a circus director, recruit performers, manage logistics, and put on spectacular shows across the country. Balance your roster of acrobats, animal acts, and clowns to attract the biggest audiences.',
  },
  173346: { // 7 Wonders Duel
    weight: 2.22, minage: 10,
    mechanics: ['cardDrafting', 'setCollection', 'handManagement', 'endGameBonuses'],
    categories: ['ancient', 'cardGame', 'cityBuilding', 'civilization'],
    description: 'In many regards, 7 Wonders Duel resembles its parent game 7 Wonders, as players acquire cards over three ages that provide resources or advance their military or scientific development. However, this two-player game features a unique card drafting mechanism from a shared display, and three distinct victory conditions: military supremacy, scientific supremacy, or civilian victory by points.',
  },
  202976: { // 7 Wonders Duel: Pantheon
    weight: 2.42, minage: 10,
    mechanics: ['cardDrafting', 'setCollection', 'handManagement', 'endGameBonuses'],
    categories: ['ancient', 'cardGame', 'civilization', 'expansion'],
    description: 'Pantheon is an expansion for 7 Wonders Duel that adds a mythological dimension to the game. Players can now invoke the powers of ancient gods and goddesses from five different pantheons. During Age I, you discover the gods available; in Age II and III, you can call upon their powers to gain powerful abilities.',
  },
  176013: { // ¡Abordaje!
    weight: 1.47, minage: 8,
    mechanics: ['handManagement', 'takeThat', 'cardPlayConflict'],
    categories: ['cardGame', 'nautical', 'fighting'],
    description: '¡Abordaje! es un juego de cartas para dos jugadores ambientado en la piratería. Los jugadores se enfrentan en un duelo naval intentando hundir el barco enemigo mediante cartas de ataque, defensa y maniobras especiales. Combina gestión de mano con timing para superar a tu rival.',
  },
  205418: { // Agricola: Family Edition
    weight: 2.23, minage: 8,
    mechanics: ['workerPlacement', 'handManagement', 'income', 'endGameBonuses'],
    categories: ['farming', 'animals', 'economic'],
    description: 'Agricola: Family Edition is an introductory version of the classic Agricola, designed to make the farming experience more accessible. Players place family members to plow fields, sow grain, raise livestock, and expand their farmstead. Without the minor improvements and occupations cards, the game focuses on the core worker placement mechanics.',
  },
  357563: { // Akropolis
    weight: 1.84, minage: 8,
    mechanics: ['tilePlacement', 'openDrafting', 'patternBuilding', 'endGameBonuses'],
    categories: ['ancient', 'cityBuilding', 'territory'],
    description: 'In Akropolis, each player builds their own ancient Greek city by drafting and placing polyomino-style hex tiles. Stack tiles to gain height bonuses, but manage your resources carefully — only districts visible from above will score. Plazas of each type multiply the score of adjacent matching districts, creating a layered puzzle.',
  },
  236457: { // Architects of the West Kingdom
    weight: 2.76, minage: 12,
    mechanics: ['workerPlacement', 'handManagement', 'variablePlayerPow', 'actionRetrieval'],
    categories: ['medieval', 'cityBuilding', 'economic'],
    description: 'In Architects of the West Kingdom, players are royal architects competing to impress the King by constructing various landmarks. Gather resources, hire apprentices, and work on the cathedral. But be careful — your workers can be captured by other players, and you may be tempted to dabble in the black market at the cost of your virtue.',
  },
  352179: { // Astro Knights
    weight: 2.58, minage: 10,
    mechanics: ['deckBagPool', 'cooperative', 'handManagement', 'variablePlayerPow'],
    categories: ['sciFi', 'cardGame', 'fantasy'],
    description: 'Astro Knights is a cooperative deck-building game set in a science-fantasy universe. Players take on the roles of knights piloting mech suits to defend their home planet from waves of enemies. Coordinate your deck builds, chain powerful combos, and defeat the boss before your defenses crumble.',
  },
  344177: { // Bananya: The Card Game
    weight: 1.17, minage: 6,
    mechanics: ['setCollection', 'handManagement', 'takeThat'],
    categories: ['cardGame', 'animals', 'humor'],
    description: 'Based on the popular anime series, Bananya: The Card Game lets players collect sets of adorable cats hiding inside bananas. Draw cards, play sets, and use special action cards to interfere with opponents. A quick and light card game perfect for families.',
  },
  379959: { // The Battle of Versailles
    weight: 2.47, minage: 10,
    mechanics: ['areaMajority', 'handManagement', 'cardPlayConflict', 'events'],
    categories: ['fighting', 'political'],
    description: 'The Battle of Versailles recreates the legendary 1973 fashion showdown between French and American designers at the Palace of Versailles. Players represent fashion houses competing for influence on the runway, managing resources and playing strategic cards to win over the audience.',
  },
  240980: { // Blood on the Clocktower
    weight: 2.54, minage: 15,
    mechanics: ['hidden', 'voting', 'variablePlayerPow', 'playerElimination'],
    categories: ['bluffing', 'deduction', 'horror', 'party', 'murder'],
    description: 'Blood on the Clocktower is a social deduction game for 5-20 players. A demon is killing off townsfolk one by one, and the town must figure out who it is before it\'s too late. With dozens of unique character roles, a storyteller running the game, and dead players who can still participate, every game tells a different story.',
  },
  364405: { // Carcassonne Big Box 7
    weight: 1.97, minage: 7,
    mechanics: ['tilePlacement', 'areaMajority', 'mapAddition', 'endGameBonuses'],
    categories: ['medieval', 'cityBuilding', 'territory'],
    description: 'Carcassonne is a tile-placement game where players draw and place tiles to build the medieval French countryside. Place your followers (meeples) on roads, cities, monasteries, and fields to score points. The Big Box includes the base game plus several expansions for greater variety.',
  },
  4390: { // Carcassonne: Hunters and Gatherers
    weight: 1.88, minage: 8,
    mechanics: ['tilePlacement', 'areaMajority', 'mapAddition', 'endGameBonuses'],
    categories: ['ancient', 'territory', 'animals'],
    description: 'Carcassonne: Hunters and Gatherers is a standalone game in the Carcassonne family set in a prehistoric landscape. Players place tiles depicting forests, rivers, lakes, and meadows, then claim features with their tribe members. Hunt for animals, fish in rivers, and gather mushrooms in this reimagining of the classic.',
  },
  245934: { // Carpe Diem
    weight: 2.62, minage: 10,
    mechanics: ['tilePlacement', 'setCollection', 'endGameBonuses', 'moveThrough'],
    categories: ['ancient', 'cityBuilding'],
    description: 'In Stefan Feld\'s Carpe Diem, players are patricians in ancient Rome developing their city districts. Navigate a selection rondel to draft building tiles, then place them in your district to create bakeries, villas, markets, and gardens. Fulfill scoring objectives at the end of each of the four rounds to maximize your prestige.',
  },
  84876: { // The Castles of Burgundy
    weight: 3.00, minage: 12,
    mechanics: ['diceRolling', 'tilePlacement', 'setCollection', 'trading', 'endGameBonuses'],
    categories: ['medieval', 'cityBuilding', 'territory', 'diceGame'],
    description: 'The Castles of Burgundy is set in the Loire Valley of medieval France. Players take the roles of aristocrats controlling small estates, striving to build settlements, trade goods, exploit silver mines, and use knowledge to grow their estates. The game uses dice to determine available actions, but strategic planning mitigates luck.',
  },
  124361: { // Concordia
    weight: 3.09, minage: 13,
    mechanics: ['handManagement', 'deckBagPool', 'moveThrough', 'trading', 'endGameBonuses'],
    categories: ['ancient', 'economic', 'nautical'],
    description: 'Concordia is a strategic game of colonization and trade in the Roman Empire. Players use identical decks of personality cards to take actions: producing goods, trading, moving colonists, and building houses across the Mediterranean. The cards you acquire determine not only your abilities but also your scoring at game end — a clever dual-purpose system.',
  },
  343899: { // Coral
    weight: 1.59, minage: 8,
    mechanics: ['tilePlacement', 'patternBuilding', 'openDrafting'],
    categories: ['abstract', 'environmental', 'animals'],
    description: 'Coral is a beautiful tile-stacking game where players build a colorful coral reef. Place coral tiles on different levels, aiming to have your color visible from above while strategically building the 3D reef structure. Simple rules create a surprisingly deep spatial puzzle.',
  },
  284083: { // The Crew: The Quest for Planet Nine
    weight: 2.03, minage: 10,
    mechanics: ['trickTaking', 'cooperative', 'communication', 'handManagement'],
    categories: ['cardGame', 'sciFi', 'space'],
    description: 'The Crew is a cooperative trick-taking card game set in outer space. Players embark on 50 missions of increasing difficulty, each requiring the team to win specific tricks according to assigned task cards. Communication is severely limited — you can only share one clue per round — making coordination a fascinating puzzle.',
  },
  437581: { // La Cuenta
    weight: 1.00, minage: 6,
    mechanics: ['handManagement', 'setCollection'],
    categories: ['cardGame', 'math', 'number', 'party'],
    description: 'La Cuenta es un juego de cartas rápido y sencillo donde los jugadores deben completar operaciones matemáticas sumando, restando, multiplicando o dividiendo. Ideal para toda la familia, combina agilidad mental con diversión para practicar cálculo de forma lúdica.',
  },
  402677: { // Daitoshi
    weight: 2.35, minage: 10,
    mechanics: ['tilePlacement', 'areaMajority', 'endGameBonuses', 'handManagement'],
    categories: ['cityBuilding', 'ancient'],
    description: 'In Daitoshi, players are architects tasked with building a magnificent Japanese city. Place building tiles strategically across the shared city grid, claiming districts and constructing landmarks. Manage your resources and timing to dominate key areas and fulfill the emperor\'s decrees.',
  },
  370591: { // Dorfromantik: The Board Game
    weight: 1.62, minage: 8,
    mechanics: ['tilePlacement', 'cooperative', 'patternBuilding', 'mapAddition'],
    categories: ['puzzle', 'territory', 'environmental'],
    description: 'Based on the beloved video game, Dorfromantik: The Board Game is a cooperative tile-placement game where players build a beautiful countryside together. Place hex tiles to extend forests, fields, rivers, and villages while trying to complete shared objectives. A peaceful, puzzle-like experience with a campaign mode that unlocks new content.',
  },
  264055: { // Draftosaurus
    weight: 1.22, minage: 8,
    mechanics: ['closedDrafting', 'diceRolling', 'setCollection', 'simultaneous'],
    categories: ['animals'],
    description: 'In Draftosaurus, players draft adorable dinosaur meeples and place them in their own zoo park. A die roll determines placement constraints each turn, and different enclosures score in unique ways — pairs, trios, diverse species, or specific types. A quick, family-friendly drafting game.',
  },
  447243: { // Duel for Cardia
    weight: 2.00, minage: 10,
    mechanics: ['handManagement', 'cardPlayConflict', 'deckBagPool'],
    categories: ['cardGame', 'fantasy', 'fighting'],
    description: 'Duel for Cardia is a head-to-head card game where two players clash in a tactical duel. Build your deck during the game, play cards for attacks and defense, and manage your resources to outlast your opponent in this fast-paced fantasy card battle.',
  },
  257164: { // Dungeon Raiders
    weight: 1.51, minage: 8,
    mechanics: ['simultaneous', 'handManagement', 'pushYourLuck', 'cooperative'],
    categories: ['cardGame', 'adventure', 'exploration', 'fantasy'],
    description: 'Dungeon Raiders is a dungeon-crawling card game where players explore a five-level dungeon, facing monsters, traps, and treasures. Each round, players simultaneously play numbered cards to resolve encounters — but resources are limited, forcing tough choices about when to commit your strongest cards.',
  },
  447110: { // Everest Go!
    weight: 1.50, minage: 8,
    mechanics: ['handManagement', 'pushYourLuck', 'setCollection'],
    categories: ['adventure', 'cardGame'],
    description: 'Everest Go! is a card game about climbing the world\'s highest peak. Players manage their hand of equipment and weather cards, pushing their luck to advance base camps while avoiding deadly storms. Collect sets of gear to prepare for the final summit push.',
  },
  216600: { // Fantastic Factories
    weight: 2.10, minage: 14,
    mechanics: ['diceRolling', 'engineBuilding', 'simultaneous', 'cardDrafting'],
    categories: ['economic', 'industry', 'diceGame'],
    description: 'Fantastic Factories is an engine-building game where players construct manufacturing empires. In the market phase, draft blueprint cards and hire contractors. In the work phase, roll dice and allocate them as workers across your factories to produce goods, generate resources, and manufacture prestige. The first to build enough triggers the endgame.',
  },
  40628: { // Finca
    weight: 2.19, minage: 10,
    mechanics: ['rondel', 'setCollection', 'pickUpDeliver', 'modularBoard'],
    categories: ['farming', 'economic'],
    description: 'Finca is set on the island of Mallorca, where players are fruit farmers harvesting and delivering tropical produce. Move your farmers around a shared windmill rondel to collect fruits — oranges, lemons, almonds, figs, and olives — then deliver sets to fulfill demand tiles across the island.',
  },
  100901: { // Flash Point: Fire Rescue
    weight: 2.30, minage: 10,
    mechanics: ['cooperative', 'actionPoints', 'diceRolling', 'modularBoard', 'variablePlayerPow'],
    categories: ['adventure'],
    description: 'Flash Point: Fire Rescue is a cooperative game where players take on the roles of firefighters rescuing victims from a burning building. Spend action points to move, fight fires, chop through walls, and carry victims to safety. But the fire spreads unpredictably — explosions can cause structural damage, and if the building collapses, everyone loses.',
  },
  65244: { // Forbidden Island
    weight: 1.74, minage: 10,
    mechanics: ['cooperative', 'handManagement', 'setCollection', 'actionPoints', 'modularBoard', 'variablePlayerPow'],
    categories: ['adventure', 'exploration', 'fantasy'],
    description: 'Forbidden Island is a cooperative game where players are adventurers on a sinking island, racing to collect four sacred treasures and escape before the island disappears beneath the waves. Trade cards, shore up sinking tiles, and coordinate your special abilities to survive.',
  },
  280032: { // Fossilis
    weight: 1.78, minage: 8,
    mechanics: ['setCollection', 'openDrafting', 'handManagement'],
    categories: ['animals', 'exploration'],
    description: 'In Fossilis, players are paleontologists excavating dinosaur bones from a layered dig site. Remove plaster tokens to reveal bones, then collect sets of fossils to assemble complete dinosaur skeletons. Supply cards provide tools and equipment that give special abilities during your digs.',
  },
  343526: { // G.I. JOE Deck-Building Game
    weight: 2.42, minage: 14,
    mechanics: ['deckBagPool', 'cooperative', 'variablePlayerPow', 'handManagement'],
    categories: ['cardGame', 'fighting', 'movies'],
    description: 'G.I. JOE Deck-Building Game is a cooperative deck-building game where players take on the roles of G.I. JOE heroes fighting against Cobra. Build your deck with weapons, vehicles, and allies to complete missions and defeat Cobra\'s schemes. Each hero has unique abilities that synergize with different strategies.',
  },
  378916: { // Gold Nugget
    weight: 1.20, minage: 6,
    mechanics: ['auction', 'handManagement', 'pushYourLuck'],
    categories: ['cardGame', 'economic'],
    description: 'Gold Nugget is a light card game where players are prospectors bidding on gold nuggets. Use your numbered cards cleverly in simple auctions — the highest card wins, but you\'ll need to manage your hand carefully as played cards don\'t return. A quick filler game with satisfying decisions.',
  },
  93: { // El Grande
    weight: 3.07, minage: 12,
    mechanics: ['areaMajority', 'auction', 'handManagement', 'simultaneous', 'events'],
    categories: ['medieval', 'political', 'territory'],
    description: 'El Grande is the quintessential area majority game. Set in medieval Spain, players are Grandes deploying caballeros across the nine regions of Spain and the mysterious Castillo. Play power cards to determine turn order and action selection, using action cards to move caballeros, score regions, and manipulate the board in this deeply strategic classic.',
  },
  320718: { // Hidden Leaders
    weight: 1.83, minage: 10,
    mechanics: ['handManagement', 'areaMajority', 'hidden', 'endGameBonuses'],
    categories: ['cardGame', 'fantasy', 'political'],
    description: 'Hidden Leaders is a card-driven game where each player secretly supports two of four factions competing for control of a fantasy realm. Play hero cards to advance faction tracks and influence the conflict, while trying to deduce your opponents\' hidden allegiances. The balance of bluffing and deduction creates tense moments.',
  },
  282524: { // Horrified
    weight: 2.04, minage: 10,
    mechanics: ['cooperative', 'actionPoints', 'handManagement', 'variablePlayerPow', 'pickUpDeliver'],
    categories: ['horror', 'adventure', 'movies'],
    description: 'In Horrified, players work together to defeat classic Universal Monsters — Dracula, Frankenstein\'s Monster, the Mummy, the Wolfman, and more. Each monster has a unique defeat condition that requires collecting specific items and completing tasks. Protect the villagers, manage your actions, and save the town before the monsters overwhelm you.',
  },
  393165: { // Inferno
    weight: 1.46, minage: 8,
    mechanics: ['trickTaking', 'handManagement', 'pushYourLuck'],
    categories: ['cardGame'],
    description: 'Inferno is a trick-taking card game inspired by the circles of Dante\'s Inferno. Players try to avoid taking certain cards that carry penalty points. Numbered and colored cards create a simple but engaging system where you must balance following suit with avoiding the infernal penalties. Collecting all penalty cards in a suit can turn a disaster into a triumph.',
  },
  353945: { // Infiltraitors
    weight: 1.80, minage: 10,
    mechanics: ['hidden', 'voting', 'handManagement', 'cooperative'],
    categories: ['bluffing', 'deduction', 'spies'],
    description: 'Infiltraitors is a social deduction game where players are agents trying to complete missions while rooting out hidden infiltrators among them. Discuss, vote, and take actions, but beware — the infiltrators are sabotaging your efforts from within. Trust is your most valuable and most dangerous resource.',
  },
  392473: { // Islet
    weight: 1.68, minage: 8,
    mechanics: ['tilePlacement', 'patternBuilding', 'endGameBonuses'],
    categories: ['abstract', 'environmental', 'animals'],
    description: 'Islet is a serene tile-placement game where players grow a coral island ecosystem. Place polyomino tiles representing different marine habitats — seagrass, coral, sand, and rock — to create a balanced ecosystem. Score by forming connected groups and fulfilling pattern objectives in this peaceful, strategic puzzle.',
  },
  70323: { // King of Tokyo
    weight: 1.49, minage: 8,
    mechanics: ['diceRolling', 'pushYourLuck', 'playerElimination', 'setCollection'],
    categories: ['fighting', 'sciFi', 'animals'],
    description: 'King of Tokyo is a dice-rolling game where giant monsters, robots, and aliens compete to be the King of Tokyo. Roll dice Yahtzee-style to attack, heal, gain energy, or score victory points. Occupying Tokyo makes you the target but gives bonus points. Be the last monster standing or the first to 20 points!',
  },
  193512: { // Kingdom Defenders
    weight: 2.00, minage: 10,
    mechanics: ['cooperative', 'handManagement', 'cardPlayConflict', 'variablePlayerPow'],
    categories: ['cardGame', 'fantasy', 'medieval', 'fighting'],
    description: 'Kingdom Defenders is a cooperative card game where players protect a fantasy kingdom from waves of invaders. Each player controls a hero with unique abilities, playing cards to defend castle walls and launch counter-attacks. Coordinate your limited resources and special powers to survive the onslaught.',
  },
  204583: { // Kingdomino
    weight: 1.20, minage: 8,
    mechanics: ['tilePlacement', 'drafting', 'patternBuilding', 'endGameBonuses'],
    categories: ['medieval', 'territory', 'cityBuilding'],
    description: 'In Kingdomino, players are lords seeking new lands to expand their kingdoms. Draft domino-shaped tiles and add them to your 5x5 grid, matching terrain types. Crowns on tiles multiply the size of connected matching terrains for points. A simple, elegant game that plays in 15 minutes with surprising strategic depth.',
  },
  379629: { // Knarr
    weight: 1.81, minage: 10,
    mechanics: ['setCollection', 'handManagement', 'openDrafting', 'endGameBonuses'],
    categories: ['cardGame', 'nautical', 'exploration', 'medieval'],
    description: 'Knarr is a Viking-themed card game where players recruit crew members and send them on expeditions to distant lands. Play cards to your crew to gain resources and abilities, then use those resources to claim destination cards worth victory points. Build an efficient engine of Norse exploration.',
  },
  425237: { // MADZEMATICZ!
    weight: 1.00, minage: 6,
    mechanics: ['simultaneous', 'memory', 'pushYourLuck'],
    categories: ['math', 'number', 'party', 'children'],
    description: 'MADZEMATICZ! is a fast-paced math game where players race to solve arithmetic challenges. Flip cards, spot the correct equations, and slap the answer before your opponents. A fun educational game that sharpens mental math skills for kids and adults alike.',
  },
  319348: { // Magna Roma
    weight: 2.51, minage: 12,
    mechanics: ['tilePlacement', 'networkRoute', 'endGameBonuses', 'income', 'engineBuilding'],
    categories: ['ancient', 'cityBuilding', 'economic'],
    description: 'Magna Roma is a tile-placement game where players build the great city of Rome. Place building tiles on a shared grid, construct roads and aqueducts, and develop your personal player board. Chain buildings together for powerful combos and fulfill objective cards to earn the most victory points.',
  },
  318977: { // MicroMacro: Crime City
    weight: 1.12, minage: 8,
    mechanics: ['cooperative'],
    categories: ['deduction', 'murder', 'puzzle'],
    description: 'MicroMacro: Crime City is a cooperative detective game played on a giant city map filled with hundreds of tiny illustrated characters. Solve 16 criminal cases by tracing character movements across the map — following suspects, identifying weapons, and reconstructing crime scenes using only your eyes and deductive reasoning.',
  },
  303057: { // Pan Am
    weight: 2.40, minage: 12,
    mechanics: ['workerPlacement', 'auction', 'networkRoute', 'events', 'engineBuilding'],
    categories: ['aviation', 'economic', 'transportation'],
    description: 'Pan Am is a strategy game that tells the story of the rise of aviation\'s most iconic airline. Players run competing airlines, bidding for routes, acquiring planes, and building networks — but Pan Am is always expanding and will buy your routes at a premium. Invest in Pan Am stock at the right time to win.',
  },
  398996: { // Panda Royale
    weight: 1.47, minage: 8,
    mechanics: ['diceRolling', 'pushYourLuck', 'setCollection', 'takeThat'],
    categories: ['animals', 'fighting', 'humor', 'diceGame'],
    description: 'Panda Royale is a dice game where adorable but fierce pandas compete in a royal battle. Roll dice to collect bamboo, attack opponents, or defend yourself. Push your luck for bigger rewards, but watch out — other pandas are hungry too! A light, fun game with charming panda artwork.',
  },
  417323: { // Panda Spin
    weight: 1.00, minage: 6,
    mechanics: ['dexterity', 'simultaneous'],
    categories: ['animals', 'children', 'party'],
    description: 'Panda Spin is a fast and fun dexterity game where players spin panda figures and race to complete challenges. Quick reflexes and a steady hand are key as you compete in various mini-games featuring adorable panda characters.',
  },
  369388: { // Penguin Airlines
    weight: 1.21, minage: 8,
    mechanics: ['handManagement', 'setCollection', 'pushYourLuck'],
    categories: ['cardGame', 'animals', 'aviation'],
    description: 'Penguin Airlines is a light card game where players manage penguin-run airline routes. Collect sets of destination cards, manage your hand of flight crew penguins, and complete routes for points. A charming family game with simple rules and just enough decisions to keep everyone engaged.',
  },
  180899: { // Ponzi Scheme
    weight: 2.62, minage: 12,
    mechanics: ['negotiation', 'trading', 'handManagement', 'income', 'commodity'],
    categories: ['economic', 'negotiation'],
    description: 'Ponzi Scheme is an economic game where players are fraudulent financiers trying to keep their Ponzi schemes running as long as possible. Borrow from new investors to pay old debts, trade industries, and manage your cash flow. The question isn\'t if you\'ll go bankrupt — it\'s when. The last player standing wins.',
  },
  3076: { // Puerto Rico
    weight: 3.29, minage: 12,
    mechanics: ['variableOrder', 'variablePlayerPow', 'trading', 'income', 'endGameBonuses'],
    categories: ['economic', 'farming', 'cityBuilding'],
    description: 'Puerto Rico is a classic euro game of production and shipping. Players select roles that grant all players an action, with the active player receiving a bonus. Build plantations, man production buildings with colonists, produce goods, trade at the trading house, or ship goods for victory points. Strategic role selection is the key to victory.',
  },
  217372: { // The Quest for El Dorado
    weight: 1.93, minage: 10,
    mechanics: ['deckBagPool', 'raceCondition', 'handManagement', 'modularBoard'],
    categories: ['adventure', 'exploration', 'racing'],
    description: 'The Quest for El Dorado is a deck-building race game where players lead expeditions through the jungles of South America toward the legendary city of gold. Buy cards to improve your deck, then play them to move through different terrains. The modular board ensures a different race every game.',
  },
  429851: { // Quorum
    weight: 2.03, minage: 10,
    mechanics: ['negotiation', 'voting', 'areaMajority', 'handManagement'],
    categories: ['political', 'negotiation'],
    description: 'Quorum is a political negotiation game where players represent factions in a parliament, forming coalitions and pushing agendas. Negotiate deals, trade votes, and pass legislation that benefits your faction. But alliances are fragile, and the political landscape shifts every round.',
  },
  28143: { // Race for the Galaxy
    weight: 2.98, minage: 12,
    mechanics: ['handManagement', 'simultaneous', 'variableOrder', 'engineBuilding', 'variablePlayerPow'],
    categories: ['cardGame', 'sciFi', 'economic', 'civilization', 'space'],
    description: 'Race for the Galaxy is a card game where players build galactic civilizations by playing cards representing worlds and developments. Cards serve as both the things you build and the currency to pay for them. Each round, players simultaneously choose phases, and only the chosen phases occur. A deep, fast-playing engine builder.',
  },
  314971: { // Ramen! Ramen!
    weight: 1.52, minage: 8,
    mechanics: ['setCollection', 'handManagement', 'openDrafting', 'endGameBonuses'],
    categories: ['cardGame'],
    description: 'Ramen! Ramen! is a card game about crafting the perfect bowl of ramen. Collect ingredient cards — noodles, broth, toppings, and spices — to fulfill recipe objectives. Draft from the market, manage your hand, and create the most delicious combinations to score the most points.',
  },
  1513: { // The Republic of Rome
    weight: 4.07, minage: 14,
    mechanics: ['negotiation', 'voting', 'handManagement', 'variablePlayerPow', 'events', 'areaMajority'],
    categories: ['ancient', 'political', 'negotiation', 'wargame'],
    description: 'The Republic of Rome is a grand political game spanning the history of the Roman Republic. Players control factions of senators, jockeying for consulships, governorships, and military commands. Negotiate alliances, prosecute rivals, and lead Rome\'s legions — but if Rome falls to external threats or civil war, everyone loses.',
  },
  427278: { // Roaring 20s
    weight: 1.50, minage: 8,
    mechanics: ['setCollection', 'handManagement', 'auction', 'pushYourLuck'],
    categories: ['cardGame', 'economic'],
    description: 'Roaring 20s is a card game set during the jazz age of the 1920s. Players compete to build the most glamorous collection of speakeasy attractions, hiring performers and acquiring contraband through auctions. A light, thematic game with art deco artwork.',
  },
  313166: { // Rocódromo
    weight: 1.05, minage: 6,
    mechanics: ['dexterity', 'diceRolling', 'pushYourLuck'],
    categories: ['adventure', 'children'],
    description: 'Rocódromo es un juego familiar de destreza y escalada. Los jugadores lanzan dados para mover a sus escaladores por la pared de escalada, eligiendo rutas y arriesgándose con movimientos difíciles. Un juego divertido y accesible que simula la emoción de la escalada deportiva.',
  },
  298102: { // Roll Camera!: The Filmmaking Board Game
    weight: 2.43, minage: 10,
    mechanics: ['cooperative', 'diceRolling', 'workerPlacement', 'handManagement'],
    categories: ['movies', 'economic'],
    description: 'Roll Camera! is a cooperative game where players work together as a film crew trying to complete a movie before the budget runs out. Roll dice to assign crew members to tasks, manage scene cards, deal with problems on set, and try to create a quality film despite constant pressure from the demanding studio.',
  },
  358284: { // Rome in a Day
    weight: 1.82, minage: 8,
    mechanics: ['tilePlacement', 'setCollection', 'openDrafting', 'endGameBonuses'],
    categories: ['ancient', 'cityBuilding'],
    description: 'Rome in a Day is a tile-placement game where players contribute to building ancient Rome. Draft and place building tiles on a shared map, creating neighborhoods and connecting landmarks. Score points for completed areas, collected resources, and matching objectives in this accessible city-building game.',
  },
  237182: { // Root
    weight: 3.72, minage: 10,
    mechanics: ['asymmetric', 'areaMajority', 'handManagement', 'variablePlayerPow', 'areaMovement'],
    categories: ['animals', 'fantasy', 'wargame', 'political'],
    description: 'Root is a game of woodland might and right. Each player controls a unique faction with completely different rules, goals, and playstyles — from the expansionist Marquise de Cat to the guerrilla Woodland Alliance. Navigate the forest clearings through area control, card play, and asymmetric warfare in this acclaimed strategy game.',
  },
  144733: { // Russian Railroads
    weight: 3.47, minage: 12,
    mechanics: ['workerPlacement', 'engineBuilding', 'income', 'endGameBonuses'],
    categories: ['trains', 'industry', 'economic'],
    description: 'Russian Railroads is a heavy worker placement game where players develop railway lines across Russia. Extend your tracks on three different routes, advance your industry marker, hire engineers for special abilities, and build engines to boost your scoring. A deeply strategic game with multiple paths to victory and satisfying engine-building mechanics.',
  },
  330769: { // Saladin
    weight: 2.53, minage: 12,
    mechanics: ['areaMajority', 'handManagement', 'areaMovement', 'events'],
    categories: ['medieval', 'wargame', 'political'],
    description: 'Saladin is a historical strategy game set during the era of the Crusades. Players take on the roles of leaders vying for control of the Holy Land, managing troops, playing event cards, and claiming territories. Balance military might with diplomatic cunning in this area control game.',
  },
  396542: { // The Same Game
    weight: 1.18, minage: 8,
    mechanics: ['patternBuilding', 'simultaneous', 'memory'],
    categories: ['abstract', 'party', 'puzzle'],
    description: 'The Same Game is a pattern-matching party game where players simultaneously try to identify matching elements across revealed cards. Quick observation and a sharp memory are key as you race to spot the same items faster than your opponents.',
  },
  394340: { // SCOPE Panzer
    weight: 1.82, minage: 10,
    mechanics: ['handManagement', 'cardPlayConflict', 'simultaneous'],
    categories: ['cardGame', 'wargame'],
    description: 'SCOPE Panzer is a two-player card game simulating World War II tank combat through a sniper scope. Players simultaneously select and reveal action cards to maneuver their tanks, aim shots, and fire. A tense, quick-playing tactical game that captures the cat-and-mouse nature of armored warfare.',
  },
  319807: { // Shogun no Katana
    weight: 3.03, minage: 12,
    mechanics: ['workerPlacement', 'setCollection', 'contracts', 'engineBuilding', 'endGameBonuses'],
    categories: ['economic', 'medieval', 'industry'],
    description: 'In Shogun no Katana, players are master swordsmiths in feudal Japan, crafting legendary katanas for the Shogun. Assign workers to gather materials, forge blades, and decorate hilts and scabbards. Fulfill commissions by completing katanas that match specific requirements, building your reputation as the finest swordsmith in Japan.',
  },
  169768: { // Space Opera
    weight: 2.48, minage: 12,
    mechanics: ['areaMovement', 'handManagement', 'variablePlayerPow', 'diceRolling'],
    categories: ['sciFi', 'space', 'adventure', 'exploration'],
    description: 'Space Opera is a sci-fi adventure game where players captain ships exploring the galaxy. Travel between star systems, complete missions, trade resources, and engage in space combat. Each captain has unique abilities that shape your approach to galactic exploration.',
  },
  232493: { // Super Voxel Raiders
    weight: 2.00, minage: 10,
    mechanics: ['cooperative', 'diceRolling', 'variablePlayerPow', 'modularBoard'],
    categories: ['adventure', 'exploration', 'sciFi'],
    description: 'Super Voxel Raiders is a cooperative dungeon-crawling game with retro pixel-art aesthetics. Players control unique heroes raiding procedurally-generated dungeons, rolling dice for combat and exploration. Work together to defeat the dungeon boss before time runs out in this love letter to classic video games.',
  },
  427084: { // Superstore 3000
    weight: 1.50, minage: 8,
    mechanics: ['setCollection', 'handManagement', 'openDrafting', 'endGameBonuses'],
    categories: ['economic', 'humor', 'sciFi'],
    description: 'Superstore 3000 is a card game set in a futuristic intergalactic supermarket. Players are store managers stocking shelves with exotic alien products, managing supply chains, and fulfilling customer orders. Collect sets of products and arrange your store layout for maximum efficiency and profit.',
  },
  167791: { // Terraforming Mars
    weight: 3.26, minage: 12,
    mechanics: ['handManagement', 'engineBuilding', 'tilePlacement', 'income', 'drafting', 'events', 'endGameBonuses'],
    categories: ['economic', 'sciFi', 'space', 'territory', 'environmental'],
    description: 'In Terraforming Mars, players control corporations working to make Mars habitable. Raise the temperature, create oceans, and develop greenery by playing project cards and managing income streams. Over generations, build an economic engine while contributing to three global parameters. With over 200 unique project cards, every game unfolds differently.',
  },
  247030: { // Terraforming Mars: Prelude
    weight: 2.87, minage: 12,
    mechanics: ['handManagement', 'engineBuilding', 'income', 'endGameBonuses'],
    categories: ['economic', 'sciFi', 'space', 'expansion'],
    description: 'Prelude is an expansion for Terraforming Mars that accelerates the early game. Each player receives Prelude cards that provide starting bonuses — extra production, resources, or special abilities — giving corporations a head start on their terraforming projects. Shorter game time with faster, more decisive early rounds.',
  },
  375651: { // That's Not a Hat
    weight: 1.04, minage: 8,
    mechanics: ['memory', 'handManagement', 'pushYourLuck'],
    categories: ['cardGame', 'party', 'memory', 'humor'],
    description: 'That\'s Not a Hat is a hilarious memory game where players pass gift cards around the table — face down. When you receive a card, you must remember what it is and pass it along. If you forget (or bluff), someone can call you out. A simple concept that creates wonderfully chaotic moments of confusion and laughter.',
  },
  215: { // Tichu
    weight: 2.29, minage: 10,
    mechanics: ['trickTaking', 'handManagement', 'betting'],
    categories: ['cardGame'],
    description: 'Tichu is a partnership climbing card game with roots in traditional Asian card games. Teams of two compete to shed their cards by playing increasingly powerful combinations — singles, pairs, sequences, and special hands. Call "Tichu" before playing your first card to bet you\'ll go out first for bonus points. A deeply strategic classic.',
  },
  119464: { // Tier auf Tier: Jetzt geht's rund!
    weight: 1.02, minage: 4,
    mechanics: ['dexterity', 'stacking', 'diceRolling'],
    categories: ['animals', 'children'],
    description: 'Tier auf Tier: Jetzt geht\'s rund! (Animal Upon Animal: Here We Turn!) is a dexterity stacking game for young children. Players take turns stacking wooden animal figures on a wobbly crocodile base. Roll the die to determine how many animals to stack and on which side. A delightful balancing challenge for little hands.',
  },
  163967: { // Tiny Epic Galaxies
    weight: 2.18, minage: 14,
    mechanics: ['diceRolling', 'engineBuilding', 'followSuit', 'variablePlayerPow', 'solo'],
    categories: ['sciFi', 'space', 'diceGame', 'exploration'],
    description: 'Tiny Epic Galaxies is a dice-rolling space game in a small box. Players control galactic empires, rolling dice to colonize planets, harvest resources, advance their empire level, and utilize planet abilities. Other players can follow your actions by spending culture, creating an interactive and dynamic turn structure.',
  },
  123540: { // Tokaido
    weight: 1.74, minage: 8,
    mechanics: ['setCollection', 'moveThrough', 'variablePlayerPow', 'endGameBonuses'],
    categories: ['travel', 'economic'],
    description: 'Tokaido simulates a journey along Japan\'s famous East Sea Road. Players are travelers, and the player furthest behind always moves next — choosing how far ahead to jump. Stop at hot springs, visit temples, meet interesting people, buy souvenirs, and paint panoramas. The most fulfilling journey wins.',
  },
  303672: { // Trek 12: Himalaya
    weight: 1.64, minage: 8,
    mechanics: ['rollWrite', 'pushYourLuck', 'solo'],
    categories: ['adventure', 'exploration'],
    description: 'Trek 12 is a roll-and-write game set in the Himalayas. Two dice are rolled each turn, and players choose how to combine them — add, subtract, multiply, or take the highest/lowest — then write the result on their expedition map. Chain numbers to create climbing routes and map areas to score. Includes a campaign mode.',
  },
  392064: { // Trekking
    weight: 1.73, minage: 8,
    mechanics: ['setCollection', 'moveThrough', 'handManagement', 'endGameBonuses'],
    categories: ['adventure', 'travel', 'exploration'],
    description: 'Trekking is a set collection game where players hike through beautiful natural landscapes. Move along trails using movement cards, collect souvenir tokens, and complete trek cards for points. Visit national parks and scenic landmarks in this family-friendly adventure game.',
  },
  298060: { // Truffle Shuffle
    weight: 1.38, minage: 8,
    mechanics: ['setCollection', 'openDrafting', 'handManagement'],
    categories: ['cardGame'],
    description: 'Truffle Shuffle is a card-drafting game where players are chocolatiers selecting truffles from an overlapping grid display. Carefully choose which chocolates to add to your box, creating sets and fulfilling customer preferences. The layered card display means your choices reveal new options for other players.',
  },
  108687: { // Puerto Rico (2011 edition)
    weight: 3.29, minage: 12,
    mechanics: ['variableOrder', 'variablePlayerPow', 'trading', 'income', 'endGameBonuses'],
    categories: ['economic', 'farming', 'cityBuilding'],
    description: 'Puerto Rico is a classic euro game of production and shipping set on the island of Puerto Rico. Players select roles that grant all players an action, with the active player receiving a bonus. Build plantations, man production buildings with colonists, produce goods, trade at the trading house, or ship goods for victory points.',
  },
  216694: { // Das Vermächtnis des Maharaja
    weight: 2.38, minage: 10,
    mechanics: ['setCollection', 'handManagement', 'auction', 'endGameBonuses'],
    categories: ['cardGame', 'economic', 'ancient'],
    description: 'Das Vermächtnis des Maharaja (The Maharaja\'s Legacy) is a card game where players are heirs competing for the treasures of a Maharaja\'s estate. Bid on artifact collections, manage your resources, and assemble the most valuable inheritance. Strategic bidding and set collection determine who claims the Maharaja\'s legacy.',
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─── Parse collection.xml ───────────────────────────────────────────────────

const collectionXml = fs.readFileSync('public/mock/collection.xml', 'utf-8')

// Split into individual items
const itemBlocks = collectionXml.split(/<item\s/).slice(1) // skip before first <item

function extractAttr(block, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`)
  const m = block.match(re)
  return m ? m[1] : null
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`)
  const m = block.match(re)
  return m ? m[1].trim() : null
}

function extractTagAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`)
  const m = block.match(re)
  return m ? m[1] : null
}

function extractRanks(block) {
  const ranks = []
  const rankRe = /<rank\s+([^>]+)\/>/g
  let m
  while ((m = rankRe.exec(block)) !== null) {
    const attrs = m[1]
    const type = attrs.match(/type="([^"]*)"/)
    const id = attrs.match(/id="([^"]*)"/)
    const name = attrs.match(/name="([^"]*)"/)
    const friendly = attrs.match(/friendlyname="([^"]*)"/)
    const value = attrs.match(/\bvalue="([^"]*)"/)
    const ba = attrs.match(/bayesaverage="([^"]*)"/)
    if (type && id && name && friendly && value && ba) {
      ranks.push({
        type: type[1], id: id[1], name: name[1],
        friendlyname: friendly[1], value: value[1], bayesaverage: ba[1],
      })
    }
  }
  return ranks
}

const games = []
const seenIds = new Set()

for (const block of itemBlocks) {
  const id = extractAttr(block, 'objectid')
  if (!id || seenIds.has(id)) continue // skip duplicates (e.g., Saladin appears twice)
  seenIds.add(id)

  const name = extractTag(block, 'name') || ''
  const yearpublished = extractTag(block, 'yearpublished')
  const image = extractTag(block, 'image')
  const thumbnail = extractTag(block, 'thumbnail')

  // Stats
  const minplayers = extractAttr(block, 'minplayers')
  const maxplayers = extractAttr(block, 'maxplayers')
  const minplaytime = extractAttr(block, 'minplaytime')
  const maxplaytime = extractAttr(block, 'maxplaytime')
  const playingtime = extractAttr(block, 'playingtime')
  const numowned = extractAttr(block, 'numowned')

  // Rating stats
  const usersrated = extractTagAttr(block, 'usersrated', 'value')
  const average = extractTagAttr(block, 'average', 'value')
  const bayesaverage = extractTagAttr(block, 'bayesaverage', 'value')
  const stddev = extractTagAttr(block, 'stddev', 'value')
  const median = extractTagAttr(block, 'median', 'value')
  const ranks = extractRanks(block)

  games.push({
    id, name, yearpublished, image, thumbnail,
    minplayers, maxplayers, minplaytime, maxplaytime, playingtime, numowned,
    usersrated, average, bayesaverage, stddev, median, ranks,
  })
}

console.log(`${games.length} juegos únicos encontrados en collection.xml`)

// ─── Generate thing XML ─────────────────────────────────────────────────────

function generateThingXml(game) {
  const data = GAME_DATA[game.id]

  if (!data) {
    console.warn(`⚠ Sin datos curados para: ${game.name} (${game.id})`)
  }

  const weight = data?.weight ?? 2.00
  const minage = data?.minage ?? 10
  const description = data?.description ?? `A board game for ${game.minplayers}-${game.maxplayers} players.`
  const mechanics = data?.mechanics ?? ['handManagement', 'setCollection']
  const categories = data?.categories ?? ['cardGame']

  const nameEscaped = escapeXml(game.name)
  const descEscaped = escapeXml(description)

  const mechanicsXml = mechanics
    .map(key => {
      const m = MECHANIC[key]
      if (!m) { console.warn(`⚠ Mecánica desconocida: ${key}`); return '' }
      return `\t\t<link type="boardgamemechanic" id="${m.id}" value="${escapeXml(m.name)}" />`
    })
    .filter(Boolean)
    .join('\n')

  const categoriesXml = categories
    .map(key => {
      const c = CATEGORY[key]
      if (!c) {
        if (key === 'expansion') return `\t\t<link type="boardgamecategory" id="1042" value="Expansion for Base-game" />`
        console.warn(`⚠ Categoría desconocida: ${key}`)
        return ''
      }
      return `\t\t<link type="boardgamecategory" id="${c.id}" value="${escapeXml(c.name)}" />`
    })
    .filter(Boolean)
    .join('\n')

  // Build ranks XML from real collection data
  const ranksXml = game.ranks.length > 0
    ? game.ranks.map(r =>
        `\t\t\t\t\t<rank type="${r.type}" id="${r.id}" name="${r.name}" friendlyname="${r.friendlyname}" value="${r.value}" bayesaverage="${r.bayesaverage}" />`
      ).join('\n')
    : `\t\t\t\t\t<rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="Not Ranked" bayesaverage="Not Ranked" />`

  return `\t<item type="boardgame" id="${game.id}">
\t\t<thumbnail>${game.thumbnail || ''}</thumbnail>
\t\t<image>${game.image || ''}</image>
\t\t<name type="primary" sortindex="1" value="${nameEscaped}" />
\t\t<description>${descEscaped}</description>
\t\t<yearpublished value="${game.yearpublished || '0'}" />
\t\t<minplayers value="${game.minplayers || '1'}" />
\t\t<maxplayers value="${game.maxplayers || '4'}" />
\t\t<playingtime value="${game.playingtime || '60'}" />
\t\t<minplaytime value="${game.minplaytime || '30'}" />
\t\t<maxplaytime value="${game.maxplaytime || '60'}" />
\t\t<minage value="${minage}" />
${categoriesXml}
${mechanicsXml}
\t\t<statistics page="1">
\t\t\t<ratings>
\t\t\t\t<usersrated value="${game.usersrated || '0'}" />
\t\t\t\t<average value="${game.average || '0'}" />
\t\t\t\t<bayesaverage value="${game.bayesaverage || '0'}" />
\t\t\t\t<stddev value="${game.stddev || '0'}" />
\t\t\t\t<median value="${game.median || '0'}" />
\t\t\t\t<ranks>
${ranksXml}
\t\t\t\t</ranks>
\t\t\t\t<averageweight value="${weight.toFixed(4)}" />
\t\t\t</ratings>
\t\t</statistics>
\t</item>`
}

// ─── Main output ────────────────────────────────────────────────────────────

const itemsXml = games.map(g => generateThingXml(g)).join('\n')

const thingsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
${itemsXml}
</items>`

fs.mkdirSync('public/mock', { recursive: true })
fs.writeFileSync('public/mock/things.xml', thingsXml)
console.log(`✓ data/things.xml generado con ${games.length} juegos mock`)
