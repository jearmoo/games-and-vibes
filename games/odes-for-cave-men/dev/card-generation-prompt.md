# Odes for Cave Men: Card Generation Prompt

Use this document to prompt an LLM to generate new cards for Odes for Cave Men.

## Game Context

Odes for Cave Men is a team party game. Each card has two fields:

- **word1**: A single word (the "base word") that the Poet sees and must get their team to guess
- **word3**: A compound word, phrase, or expression that *contains* word1 and gives the Poet something specific to describe

The Poet sees both word1 and word3. They describe word3 (without saying word1) so their teammates can guess word1. The opposing team has a "Bonker" who can see word3 and penalize bad guesses.

**Example flow**: Card is `"Tooth" -> "Tooth Fairy"`. The Poet might act out or describe a fairy that collects teeth. Guessers say "Tooth!" and score.

## Card Data Format

```json
{ "1": "Tooth", "3": "Tooth Fairy" }
```

word1 is always a substring of word3 (either as a standalone word, a prefix, or embedded in a compound).

## What Makes a Good Card

### The Core Tension

The best cards create a specific, clueable mental image while keeping word1 non-obvious. The Poet needs something *concrete to describe*, and the guessers need to be able to *arrive at* word1 from that description without it being instantly obvious.

### Structural Patterns That Work

Cards follow one of these composition patterns:

1. **[Modifier] + word1**: An adjective or noun narrows word1 into something specific.
   - `"Shower" -> "Cold Shower"`, `"Cheese" -> "Grilled Cheese"`, `"Salad" -> "Caesar Salad"`

2. **word1 + [Noun/Modifier]**: word1 leads into a compound phrase.
   - `"Tooth" -> "Tooth Fairy"`, `"Fire" -> "Fire Hydrant"`, `"Gas" -> "Gas Mask"`

3. **Compound word containing word1**: word1 is embedded inside a single compound word.
   - `"Wolf" -> "Werewolf"`, `"Drum" -> "Drumstick"`, `"Lap" -> "Laptop"`, `"Hawk" -> "Mohawk"`

4. **Multi-word phrase/expression containing word1**:
   - `"Hair" -> "Bad Hair Day"`, `"Water" -> "White Water Rafting"`, `"Foil" -> "Tin Foil Hat"`

5. **Idiomatic expressions or sayings**:
   - `"Rags" -> "Rags to Riches"`, `"Piece" -> "Piece of Cake"`, `"Partner" -> "Partner in Crime"`

### Qualities of Strong Cards

**Concrete and visual.** The Poet should be able to pantomime, describe a scene, or paint a picture. Cards like `"Fire" -> "Fire Hydrant"` or `"Whale" -> "Beached Whale"` give the Poet a vivid, specific thing to describe.

**The phrase shifts the meaning.** The best cards make word1 feel different in context than it does alone. `"Stool" -> "Stool Pigeon"` is better than `"Stool" -> "Wooden Stool"` because the phrase takes the word somewhere unexpected, giving the Poet a richer clue path and making the guessing more interesting.

**Universally recognizable.** The phrase should be something most English speakers know. `"Banana" -> "Banana Split"`, `"Fortune" -> "Fortune Cookie"`, `"Hamster" -> "Hamster Wheel"` all work because everyone knows what these are. Regional slang, niche jargon, or obscure references make bad cards.

**word1 is common vocabulary.** Base words should be everyday nouns, verbs, or adjectives. The existing banks use words like: Quiz, Fence, Blood, Window, Love, Frog, Ghost, Shoe, Star, Dog. Avoid obscure or technical words.

**The phrase adds specificity.** Going from word1 to word3 should narrow the concept dramatically. `"Band"` is vague. `"Heavy Metal Band"` is specific and clueable. `"Surgery"` is broad. `"Plastic Surgery"` is specific and funny.

**Multiple clue paths.** Great cards let the Poet approach from different angles. `"Pillow" -> "Pillow Fight"` can be clued through sleeping + combat, softness + aggression, slumber party, etc.

### Gray vs. Red (Difficulty Tiers)

**Gray (easier):**
- word3 is a very common phrase or compound that comes to mind quickly
- word1 often appears at the start of word3, making it more guessable
- The connection between word1 and the rest of the phrase is direct
- Examples: `"Toilet" -> "Toilet Paper"`, `"Snow" -> "Snowball Fight"`, `"Orange" -> "Orange Juice"`, `"Pizza" -> "Pizza Pie"`

**Red (harder):**
- word3 uses word1 in a less obvious or more idiomatic way
- word1 may be embedded inside a compound word (prefix/suffix)
- The phrase may require more lateral thinking to clue
- The Poet has to work harder to describe without giving away word1 directly
- Examples: `"Crow" -> "Scarecrow"`, `"Blade" -> "Rollerblade"`, `"Mate" -> "Checkmate"`, `"Coast" -> "Rollercoaster"`, `"Hog" -> "Hedgehog"`

## What Makes a Bad Card

**word3 is just word1 + a generic descriptor.** `"Dog" -> "Large Dog"` or `"Chair" -> "Wooden Chair"` are boring. The Poet has nothing interesting to describe beyond the base word itself. The modifier needs to create a *new concept*, not just qualify the old one.

**word3 is too obscure.** If most players won't recognize the phrase, the card fails. Niche scientific terms, regional expressions, or deep cultural references that only some players would know.

**word1 is immediately obvious from any description of word3.** If you can't describe word3 without essentially saying word1, the card is too easy and boring. `"Moon" -> "Moon"` (which actually exists in the base red set) is the extreme bad case.

**The phrase doesn't evoke a concrete image.** Abstract combinations like `"Quality" -> "Quality Assurance"` or `"Policy" -> "Open Door Policy"` are harder to clue because there's nothing to act out or visualize. These can work in the red/harder tier but should be avoided for gray.

**word1 appears only tangentially in word3.** The word should be a meaningful part of the phrase, not incidental. Avoid cases where word1 is technically present but the phrase doesn't really "feature" it.

**Potentially offensive content.** The game is a party game played in groups. Cards should be fun and family-friendly (or at least broadly inoffensive). The existing cards include mild humor (`"Poop" -> "Poop Scoop"`, `"Fart" -> "Silent Fart"`, `"Crack" -> "Plumber's Crack"`) but nothing mean-spirited.

**Duplicate base words.** The existing banks already contain ~1400 cards. Check that word1 is not already used (a few duplicates exist in the original data, like "Break" -> "Winter Break" appearing in both base sets, and "Fruit" appearing in both base gray and expansion red, but new cards should avoid this).

## Existing word1 Values to Avoid (Already Used)

When generating new cards, avoid reusing these base words. The full list across all four banks:

### Base Gray (200)
Quiz, Fence, Doughnut, Funeral, Blood, Side, Window, Toy, Gold, Fruit, Love, Taco, Wash, Whale, Happy, Mind, Wedding, Tongue, Tape, Walk, Empty, Bank, Sweat, Newspaper, Hat, Skin, Fall, Email, Sink, Suit, Hair, Wife, Frog, Refrigerator, Voice, Split, Toilet, Family, Tall, Teacher, Talk, Sun, Spoon, Fry, Surgery, Ghost, Golf, Taste, Glove, Handle, Friend, Elephant, Hand, Stone, Question, Green, Vegetable, Table, Vacation, Sugar, Sweater, Syrup, Silent, Grass, Sleep, Wave, World, Drum, Wall, Easy, Ladder, Globe, Stool, Fact, Water, Farm, Sword, Fist, Double, Down, Summer, Fossil, Foot, Gas, Fork, Dry, Egg, Scarf, Dream, Earth, Driver, Stop, Fire, Spill, Tooth, Garage, Glass, Drive, Finger, Hamster, Track, Trash, Lip, Hawk, House, Five, Tree, Spot, Team, Short, Hot, Stomach, Heart, Stamp, Hungry, Life, Under, Storm, Gum, Hunt, Ketchup, Trip, Zoo, Head, Ice, Train, Kill, Student, Smoke, Snake, Shoe, Turtle, Up, First, Kick, Trap, Lick, Wolf, Army, Shrimp, Skirt, Lion, Street, Shower, Socks, Kitchen, Zebra, Tutor, Hotel, Wood, Star, Dog, Snow, Jacket, Sloppy, Toast, Airport, Wheel, Fight, Flower, Lemon, Shell, Juice, Hip, Stick, Soup, Hospital, Tiger, Jar, Strawberry, Lap, Horse, White, School, Fish, Square, Light, Shark, Knee, Flame, Ten, High, Land, Fly, Soft, Start, Shirt, Seven, Sausage, Home, Foil, Jeans, Jelly, Leather, Secret, Food, Leg, Thumb, Hole, Island

### Base Red (200)
Menu, Blade, Nap, Cake, Barn, Advice, Candy, Crumb, Seat, Bird, Poop, Massage, Alligator, Radio, Sand, Birthday, Bag, Angel, Bath, Cone, Pie, Baby, Bite, Movie, Pump, Batter, Sack, Road, Puppy, Parade, Small, Circle, Balloon, Bounce, Crash, Bar, Close, Castle, Brush, Bug, Animal, Ant, Bone, Clam, Pumpkin, Apple, Salad, Camera, Pickle, Break, Bench, Cow, Pork, Cut, Root, Salt, Pancake, Bucket, Boot, Belly, Roast, Dirt, Butterfly, Potato, Ring, Cart, Peace, Pull, Calendar, Monkey, Chocolate, Puddle, Ride, Queen, Rain, Cookie, Brother, Brain, Battle, Moon, Bubble, Button, Boy, Candle, Room, Band, North, Bus, Banana, Cup, Rice, Butter, Bedroom, Popcorn, Popsicle, Dad, Bread, Bowling, Bee, Rose, Beach, Party, Dance, Burrito, Pink, Chain, Oven, Park, Man, Lucky, Dinner, Date, Poison, Crack, Boat, Pet, Cover, Nest, Diamond, Dark, Crab, Magic, Carrot, Penny, Coal, Market, Cry, Long, Day, Ninja, Marriage, Macaroni, Nail, Mobile, Death, Lunch, Door, Dirty, Crayon, Phone, Meat, Money, Brick, Computer, Bride, Medicine, Milk, Doctor, Belt, Piano, Bottle, Pool, Nurse, Mouth, Mate, Chef, Nose, Note, Pail, Pants, Guitar, Pan, Pole, Pack, Bowl, Bacon, Old, Roll, Coffee, Morning, Cheese, Police, Neck, Blanket, Chicken, Pizza, Rags, Clown, Olympics, Plate, Dead, Poker, Name, Boil, Pitch, Oil, Muscle, Pillow, Mountain, Bun, Picnic, Chair, Paper, Noise, Photo, Bathroom, Watch, Club, Private

### Expansion Gray (500)
Stretch, Stork, Sticker, Steer, Steel, Steam, Steal, Station, Staple, Stain, Stack, Squirrel, Squid, Style, Surfing, Swamp, Swat, Sweep, Sweet, Swing, Swirl, System, Tackle, Taffy, Squeeze, Thunder, Thought, Thigh, Tennis, Temple, Tattoo, Task, Target, Tan, Tambourine, Take, Squeak, Slip, Tights, Tinfoil, Tip, Tired, Toad, Today, Toe, Tofu, Topic, Torch, Sprout, Slipper, Truth, Trend, Trainer, Traffic, Tradition, Trade, Tough, Tot, Tortoise, Tornado, Splash, Slope, Tuna, Turkey, Turn, Tutu, Uniform, Union, Vacuum, Veil, Venom, Vest, Spin, Sloth, Wig, Wide, Whisper, Weekend, Walrus, Wait, Wagon, Waffle, Voyage, Vine, Spike, Snooze, Zipper, Yarn, Writer, Wrinkle, Wrestler, Wrench, Wrap, Wisdom, Wire, Wink, Spider, Soccer, Spear, Sound, Shout, Show, Shut, Sick, Sign, Sit, Skate, Skill, Skip, Sleeve, Sewer, Shade, Shadow, Shampoo, Sheet, Shepherd, Shine, Shock, Shore, Shoulder, Scratch, Screwdriver, Search, Seaweed, Seed, Seek, Send, Sense, Separate, Set, Rubber, Rude, Run, Sad, Sauce, Scale, Scalpel, Scan, Scary, Score, Rehersal, Reject, Respect, Rhino, Ripple, Rise, River, Roar, Rocket, Rod, Proper, Proposal, Public, Push, Visit, Quarter, Rabbit, Raffle, Rebel, Reflection, Plunger, Pond, Pop, Pot, Potion, Pray, President, Price, Priority, Promise, Pepper, Permit, Pick, Piece, Pilot, Pinch, Pipe, Plan, Plank, Pliers, Parrot, Partner, Pass, Pasture, Pawn, Peacock, Pearl, Peas, Penguin, People, Ostrich, Otter, Outline, Owl, Ox, Pace, Paint, Pale, Palm, Panda, Grumble, Growl, Grow, Ground, Gross, Grin, Grim, Grill, Gravity, Grab, Human, Hum, Hour, Hop, Holler, Hike, Helmet, Heel, Haunt, Haul, Knowledge, Keep, Kangaroo, Jungle, Join, Jam, Itch, Invitation, Insult, Inspector, Opposite, Onion, Omelet, Odd, Oatmeal, Nod, Net, Nerve, Neighbor, Needle, Mustang, Mustache, Mud, Move, Mouse, Moose, Monster, Mold, Mirror, Mirage, Midnight, Middle, Melon, Medium, Medal, Match, Marsh, Manatee, Mallet, Makeup, Mad, Lullaby, Lost, Look, Log, Location, Lobster, Lobby, Loan, Llama, Harvest, Ham, Guest, Guess, Grunt, Imposter, Imaginary, Hyena, Hurt, Humble, Neat, Nanny, List, Line, Lime, Mill, Migration, Library, Level, Lettuce, Main, Magazine, Lesson, Leaf, Layer, Lizard, Listen, Lawn, Lamp, Lamb, Arm, Asteroid, Carry, Casino, Elbow, Experiment, Gossip, Argue, Attempt, Canvas, Caterpillar, Eggplant, Fair, Gorilla, Archery, Audience, Cane, Ceremony, Eel, Falcon, Glue, Arch, Avocado, Camel, Chisel, Eat, Farmer, Giraffe, Anvil, Background, Cactus, Circus, Eagle, Fart, Garlic, Ankle, Bail, Cab, Clean, Dribble, Feast, Gap, Allowance, Bait, Bamboo, Burp, Compare, Dress, Feet, Fuse, Allergy, Beard, Bulk, Connection, Dove, Figure, Furniture, Aisle, Beat, Buckle, Cost, Dolphin, Flamingo, Fun, Beep, Brook, Cream, Dodge, Flat, Full, Bet, Broke, Crunch, Disturb, Flea, Frown, Blink, Broccoli, Dare, Dimples, Flip, Friday, Blister, Braid, Deed, Desserts, Follow, Fresh, Board, Bolt, Delivery, Department, Fox, Frame, Admit, Adventure, Acting, Cork, Donkey, Find, Doodle, Shovel, Honey, Hail, Dunk, Beet, Chili, Lance, Cologne, Shave, Dump, Foundation, Chart, Hammer, Saw, Ruler, Flash, Tool, Axe, Pin, Trust, Peak, Hill, Guide, Rush, Victory, Equal, Wonder, Stage, Craft, Meet, Bunch, Motor, Order, Recess, Mall, Rainbow, Natural, Collection, Event, Sore, Sports, Screen, Cupcake, Heal, Lecture, Risk, Sail, Grade, Rest, Hoop, Spy, Total, Tank, Studio, Range, Carousel, Slide, Pay, Habit, Patience, Theater, Pocket, Point, Powder, Railroad, Hide, Red, Sample, Worm, Flood, Floor, Folder, Folk, Fortune, Gate, Gem, Good, Quilt, Path, Spine, Couch, Den, Dock, Van, Rat, Drift, Expert, Check, Fan, Balance, Belief, Berry, Iron, Blank, Pit, Tulip, Catch, Center, Tug

### Expansion Red (500)
Crow, Exit, Reset, Tissue, Weather, Steak, Shelter, Wax, Tire, Cabbage, Bronze, Internet, Fridge, Goal, Study, Television, Ability, History, Sting, Estate, Circuit, Pear, Soul, Fiction, Dune, Sliver, Skeleton, Bush, Fantasy, Hug, Purse, Fate, Mushroom, Whistle, Evening, Bean, Tarot, Blast, Dish, Spice, Story, Father, Coat, Common, Passage, Theory, Pencil, Donut, Heaven, Village, News, Complaint, Fabric, Rug, Clue, Roof, Number, Measure, Robe, Brunch, Policy, Frenzy, Carnival, Boost, Can, Wallet, Seal, Goose, Submarine, Language, Rattle, Battery, Brass, Cartoon, Carbon, Quality, Initiative, Leopard, Flow, Waste, Sea, Knife, Parent, Mistake, Tie, Change, Product, Printer, Marble, Zone, Attack, Cheer, Grave, Spell, Reunion, Puzzle, Rig, Science, Coconut, Duet, Gut, Chip, Ear, Engineer, Error, Energy, Education, Duel, Anchor, Editor, Deodorant, Crust, Smile, Arrow, Porcupine, Exam, Quick, Response, Grand, Bronco, Well, Inflation, Rescue, Chase, Mark, Sister, Streak, Release, Microscope, Half, Pour, Tea, Hockey, Care, Bonus, Step, Nature, Witch, Pen, Jump, Picture, Shield, Sled, Spaghetti, Labor, Snap, Moth, Campus, Tide, Sneeze, Soap, Staircase, Coin, Robin, Child, Puff, Organ, Laugh, Pine, Mop, Lavender, Auction, Insurance, Company, Woman, Cushion, Bow Tie, Corn, Feather, Year, Sigh, Necklace, Tomato, Trail, Knock, Night, Memory, Surprise, Cartridge, Buzz, Clap, Delay, Camp, Olive, Sky, Fee, Offer, Kid, Tail, Week, Catapult, Ad, Goat, Record, Moment, Stream, Weed, Class, Store, Entry, Cast, Code, Comfort, Joke, Game, Forest, Fountain, Grace, Exhibit, Microwave, Border, Charity, Broom, Acid, Cold, Play, Hook, Community, Book, Pig, Ram, Clock, Razor, Fruit, Bat, Role, Reading, Brace, Fix, Boss, Spark, Beam, Reef, Silver, Cooking, Chop, Model, Fog, Hog, Foam, Cabin, Stampede, Coast, Trailer, Cheek, Media, Blaze, Canoe, Formal, Soda, Spirit, Rodeo, Repair, Speech, Clothing, Burn, Girl, Bouquet, Cannon, Peanut, Rear, Slap, Towel, Retreat, Car, Bull, Pod, Buffalo, Straw, Disk, Desk, Dig, Deck, Deal, Edge, Diet, Dip, Deep, Danger, Donation, Drawer, Diver, Drama, Drop, Bridge, Drain, Doll, Dragon, Dozen, Group, Guard, Glow, Grind, Gift, Grape, Giggle, Dust, Flour, Guilty, Face, Flag, Film, Flight, Essay, Escape, Branch, Jury, Elevator, Curtain, Curve, Cruise, Crime, Crown, Cricket, Creature, Howl, Cocktail, Crocodile, Test, Crane, Cradle, Crate, Sponge, Way, Peach, Cough, Count, Corner, Badge, Contest, Hermit, Artist, Coil, Choir, Copy, Collar, Choice, Compass, Professor, Bonnet, Buy, Blender, Birth, Tear, Barrel, Ancient, Chapter, Briefcase, Hall, King, Tower, Heat, Idea, Hay, Key, Kite, Hear, Print, Bottom, Charge, Ball, Comb, Depth, Design, Control, Breath, Diary, Cellar, Bend, Chemical, Dart, Bin, Chill, Chest, Tray, Bitter, Barge, Bell, Enemy, Dungeon, Air, Apron, Echo, Eclipse, Antler, Duck, Job, Back, Ink, Alpha, Bed, Armor, Beaver, Bargain, Chandelier, Courage, Costume, Curry, Crush, Call, Art, Beetle, Beef, Budget, Bike, Cabinet, Autumn, Chance, Punch, Mug, Dial, Act, Cliff, Crop, Blossom, Blue, Cross, Perfume, Captain, Daisy, Drill, Drink, Cage, Country, Drag, Cycle, Chrome, Champion, Mammoth, Body, Buck, Cap, Almond, Drawing, Custom, Career, Business, Dancer, Album, Action, Bracelet, Joy, Cinema, Curse, Ivory, Bullet, Burglar, Alley, Comic, Court, Crowd, Global, Dagger, Cherry, Baggage, Axis, Guardian, Bob, Clay, Cell, Clothes, Snack, Cucumber, Storage, Snail, Boom, Everything, Fiber, Holiday, Scar, Cloud, Brake, Church, Comedy, Tar, Page, Willow, Tax, Husband, Fashion, Affair, Field, Work, Skull, Mole, Box, Eye, Wind, Cereal, Cousin, Hound, Pyramid, Prize, Song, City, Ticket, Stress, Heavy, Chalk, Math

## Generation Prompt

Use the following as a prompt when asking an LLM to generate new cards:

---

You are generating word cards for a party game called Odes for Cave Men.

Each card has:
- **word1**: A common, everyday English word (noun, verb, or adjective)
- **word3**: A well-known phrase, compound word, or expression that contains word1

Rules:
1. word1 MUST appear as a substring within word3 (as a standalone word, prefix, or embedded in a compound)
2. word3 must be a real, widely recognized phrase, compound word, or expression
3. word1 should be a common, simple English word
4. word3 should evoke a concrete, visual, or actable concept (the Poet needs to describe it through pantomime or verbal clues without saying word1)
5. The phrase should transform or contextualize word1 in an interesting way
6. Cards should be fun and broadly inoffensive (light bathroom/body humor is fine)

For **gray (easier)** cards:
- Use very common, instantly recognizable phrases
- word1 often appears at the beginning of word3
- The connection should be direct and obvious

For **red (harder)** cards:
- word1 can be embedded inside compound words (e.g., "Crow" in "Scarecrow")
- Use more idiomatic or lateral phrases
- The clue path should require more creative thinking

Output format (JSON):
```json
{ "1": "word1", "3": "word3" }
```

Do NOT use any of the following word1 values (they are already in the game):
[INSERT THE FULL LIST OF EXISTING word1 VALUES FROM ABOVE]

Generate [N] new [gray/red] cards.

---
