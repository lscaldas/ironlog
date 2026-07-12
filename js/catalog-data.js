"use strict";
/* ================= Library (autocomplete) ================= */
const LIB=["Cable Rows","Pullups","Pushups","Overhead Press","Single-arm Face Pulls","Ring Dips","Triceps Pulldown","Triceps Overhead Ext.","Cable Lateral Raise - Lower Path","Cable Lateral Raise - Upper Path","Bayesian Single-arm Curl","Single-arm Cable Shrugs","Cable Squats","Single Cable Leg Curl","Cable Single-leg Calf Raise","Bench Press","Lat Pulldown"];
const SEED=[
  {name:"Cable Rows",bucket:"Upper",muscle:"Back",area:"Mid back / lats",target:4,low:6,high:10,inc:2.5,notes:"sit, cable row, 1cab1.4/2m"},
  {name:"Pullups",bucket:"Upper",muscle:"Back",area:"Lats",target:4,low:5,high:10,inc:2.5,notes:"bar, bodyweight"},
  {name:"Pushups",bucket:"Upper",muscle:"Chest",area:"Mid chest",target:4,low:15,high:30,inc:2.5,notes:"bodyweight"},
  {name:"Overhead Press",bucket:"Upper",muscle:"Shoulders",area:"Front delts",target:4,low:6,high:12,inc:2.5,notes:"barbell"},
  {name:"Single-arm Face Pulls",bucket:"Upper",muscle:"Shoulders",area:"Rear delts / upper back",target:2,low:10,high:15,inc:2.5,notes:"single arm, 1cab2m"},
  {name:"Cable Squats",bucket:"Legs",muscle:"Quads",area:"Quads / glutes",target:3,low:6,high:10,inc:2.5,notes:"cable squat"},
  {name:"Single Cable Leg Curl",bucket:"Legs",muscle:"Hamstrings",area:"Hamstrings",target:3,low:8,high:12,inc:2.5,notes:"single cable"},
  {name:"Cable Single-leg Calf Raise",bucket:"Legs",muscle:"Calves",area:"Calves",target:4,low:10,high:20,inc:2.5,notes:"single leg cable"},
  {name:"Ring Dips",bucket:"Arms",muscle:"Chest",area:"Lower chest / triceps",target:4,low:6,high:12,inc:2.5,notes:"rings, bodyweight"},
  {name:"Triceps Pulldown",bucket:"Arms",muscle:"Triceps",area:"Lateral / medial head",target:3,low:8,high:12,inc:2.5,notes:"1cab1.4m"},
  {name:"Triceps Overhead Ext.",bucket:"Arms",muscle:"Triceps",area:"Long head",target:3,low:8,high:12,inc:2.5,notes:"1cab2m"},
  {name:"Cable Lateral Raise - Lower Path",bucket:"Arms",muscle:"Shoulders",area:"Side delts - lower path",target:2,low:10,high:15,inc:1.25,notes:"start low, finish around shoulder height"},
  {name:"Cable Lateral Raise - Upper Path",bucket:"Arms",muscle:"Shoulders",area:"Side delts - upper path",target:2,low:10,high:15,inc:1.25,notes:"starts where lower path ends, finishes overhead"},
  {name:"Bayesian Single-arm Curl",bucket:"Arms",muscle:"Biceps",area:"Biceps",target:6,low:8,high:12,inc:1.25,notes:"single arm, cable behind body, 1cab1.4/2m"},
  {name:"Single-arm Cable Shrugs",bucket:"Arms",muscle:"Traps",area:"Upper traps",target:2,low:10,high:15,inc:2.5,notes:"single arm cable, 1cab1.4/2m"},
];

/* ================= Muscle taxonomy ================= */
const MUSCLES=["Chest","Back","Shoulders","Traps","Biceps","Triceps","Forearms","Quads","Hamstrings","Glutes","Calves","Core"];
const AREAS=["Upper chest","Mid chest","Lower chest / triceps","Chest isolation","Lats","Mid back / lats","Upper back","Rear delts / upper back","Front delts","Side delts - lower path","Side delts - upper path","Side delts - full range","Upper traps","Biceps","Forearms","Triceps long head","Lateral / medial head","Quads / glutes","Hamstrings","Calves","Core"];
const MUSCLE_REGION={Chest:"Upper",Back:"Upper",Shoulders:"Upper",Traps:"Upper",Biceps:"Upper",Triceps:"Upper",Forearms:"Upper",
  Quads:"Lower",Hamstrings:"Lower",Glutes:"Lower",Calves:"Lower",Core:"Core"};
const MUSCLE_PPL={Chest:"Push",Shoulders:"Push",Triceps:"Push",Back:"Pull",Biceps:"Pull",Traps:"Pull",Forearms:"Pull",
  Quads:"Legs",Hamstrings:"Legs",Glutes:"Legs",Calves:"Legs",Core:"Core"};
const AREA_PPL={"Rear delts / upper back":"Pull","Upper back":"Pull","Lats":"Pull","Mid back / lats":"Pull","Upper traps":"Pull",
  "Lower chest / triceps":"Push","Upper chest":"Push","Mid chest":"Push","Chest isolation":"Push","Front delts":"Push",
  "Side delts - lower path":"Push","Side delts - upper path":"Push","Side delts - full range":"Push","Triceps long head":"Push","Lateral / medial head":"Push",
  "Biceps":"Pull","Forearms":"Pull","Quads / glutes":"Legs","Hamstrings":"Legs","Calves":"Legs","Core":"Core"};
const NAME_MUSCLE={"Rows":"Back","Cable Rows":"Back","Pullups":"Back","Lat Pulldown":"Back","Pushups":"Chest","Bench Press":"Chest","Cable Flys":"Chest","Ring Dips":"Chest",
  "Shoulder Press":"Shoulders","Overhead Press":"Shoulders","Face Pulls":"Shoulders","Single-arm Face Pulls":"Shoulders","Lateral Raises":"Shoulders","Cable Lateral Raise - Lower Path":"Shoulders",
  "Cable Lateral Raise - Upper Path":"Shoulders","Triceps Pulldown":"Triceps","Triceps Overhead Ext.":"Triceps",
  "Dips":"Triceps","Biceps Curls":"Biceps","Bayesian Single-arm Curl":"Biceps","Shrugs":"Traps","Single-arm Cable Shrugs":"Traps","Squats":"Quads","Cable Squats":"Quads","Leg Curls":"Hamstrings","Single Cable Leg Curl":"Hamstrings","Calf Raises":"Calves","Cable Single-leg Calf Raise":"Calves"};
const NAME_AREA={"Rows":"Mid back / lats","Cable Rows":"Mid back / lats","Pullups":"Lats","Lat Pulldown":"Lats","Pushups":"Mid chest","Bench Press":"Mid chest",
  "Cable Flys":"Chest isolation","Ring Dips":"Lower chest / triceps","Shoulder Press":"Front delts","Overhead Press":"Front delts","Face Pulls":"Rear delts / upper back","Single-arm Face Pulls":"Rear delts / upper back",
  "Lateral Raises":"Side delts - lower path","Cable Lateral Raise - Lower Path":"Side delts - lower path",
  "Cable Lateral Raise - Upper Path":"Side delts - upper path","Triceps Pulldown":"Lateral / medial head",
  "Triceps Overhead Ext.":"Triceps long head","Biceps Curls":"Biceps","Bayesian Single-arm Curl":"Biceps","Shrugs":"Upper traps","Single-arm Cable Shrugs":"Upper traps",
  "Squats":"Quads / glutes","Cable Squats":"Quads / glutes","Leg Curls":"Hamstrings","Single Cable Leg Curl":"Hamstrings","Calf Raises":"Calves","Cable Single-leg Calf Raise":"Calves"};
/* Secondary weights = fraction of a direct set's stimulus the muscle receives.
   Rubric (EMG + longitudinal indirect-growth data, e.g. pressing→triceps,
   pulldowns→biceps): ~.5 heavy synergist through full ROM, .2–.35 moderate
   synergist, .1–.15 stabilizer/isometric. Grip (forearm flexors +
   brachioradialis) is counted on unsupported pulls and hangs, scaled to load:
   bodyweight hang ≈ .3, heavy bar pull ≈ .25, cable/machine handle ≈ .15–.2. */
const EXERCISE_TAXONOMY=[
  {base:"Pushups", muscle:"Chest", area:"Mid chest", keys:["pushup","push-up","push up"], secondary:{Triceps:.45,Shoulders:.35,Core:.1}},
  {base:"Bench Press", muscle:"Chest", area:"Mid chest", keys:["bench","bench press","press bench","barbell bench"], secondary:{Triceps:.45,Shoulders:.35}},
  {base:"Incline Bench Press", muscle:"Chest", area:"Upper chest", keys:["incline bench","incline press","incline dumbbell press","incline db press"], secondary:{Shoulders:.45,Triceps:.4}},
  {base:"Dumbbell Press", muscle:"Chest", area:"Mid chest", keys:["dumbbell press","db press","flat dumbbell press"], secondary:{Triceps:.4,Shoulders:.3}},
  {base:"Cable Chest Press", muscle:"Chest", area:"Mid chest", keys:["cable chest press","standing cable press","single arm cable press"], secondary:{Triceps:.4,Shoulders:.3}},
  {base:"Chest Fly", muscle:"Chest", area:"Chest isolation", keys:["fly","flye","dumbbell fly","cable fly","cable crossover"], secondary:{Shoulders:.15}},
  {base:"Standing Cable Chest Fly", muscle:"Chest", area:"Chest isolation", keys:["standing cable chest fly","standing cable fly","cable fly standing"], secondary:{Shoulders:.15}},
  {base:"Low-to-high Cable Fly", muscle:"Chest", area:"Upper chest", keys:["low to high cable fly","low-to-high cable fly","low cable fly","cable fly low"], secondary:{Shoulders:.25}},
  {base:"High-to-low Cable Fly", muscle:"Chest", area:"Lower chest / triceps", keys:["high to low cable fly","high-to-low cable fly","high cable fly","cable crossover high"], secondary:{Shoulders:.15}},
  {base:"Pec Deck", muscle:"Chest", area:"Chest isolation", keys:["pec deck","machine fly","machine chest fly"], secondary:{Shoulders:.1}},
  {base:"Ring Dips", muscle:"Chest", area:"Lower chest / triceps", keys:["ring dip","rings dip","chest dip","weighted dip"], secondary:{Triceps:.65,Shoulders:.25}},
  {base:"Parallel Bar Dips", muscle:"Chest", area:"Lower chest / triceps", keys:["parallel bar dip","bar dip","parallel dips"], secondary:{Triceps:.65,Shoulders:.35}},
  {base:"Assisted Dips", muscle:"Chest", area:"Lower chest / triceps", keys:["assisted dip","assisted dips","machine dip"], secondary:{Triceps:.65,Shoulders:.35}},
  {base:"Incline Pushups", muscle:"Chest", area:"Lower chest / triceps", keys:["incline pushup","incline push-up","incline push up"], secondary:{Shoulders:.25,Triceps:.35,Core:.1}},
  {base:"Decline Pushups", muscle:"Chest", area:"Upper chest", keys:["decline pushup","decline push-up","decline push up"], secondary:{Shoulders:.45,Triceps:.35,Core:.1}},
  /* Lengthened partials: bottom half keeps chest/delts at long length; the
     triceps' lockout work never happens, so their share drops sharply. */
  {base:"Bottom-half Pushups", muscle:"Chest", area:"Mid chest", keys:["bottom half pushup","pushup bottom","pushups bottom","prison pushup","lengthened partial pushup","partial pushup"], secondary:{Shoulders:.35,Triceps:.2,Core:.1}},
  {base:"Bottom-half Decline Pushups", muscle:"Chest", area:"Upper chest", keys:["decline pushup bottom","decline pushups bottom","bottom half decline pushup","decline prison pushup"], secondary:{Shoulders:.45,Triceps:.2,Core:.1}},

  {base:"Pullups", muscle:"Back", area:"Lats", keys:["pullup","pull-up","pull up"], secondary:{Biceps:.5,Traps:.2,Forearms:.3}},
  {base:"Chin-ups", muscle:"Back", area:"Lats", keys:["chinup","chin-up","chin up"], secondary:{Biceps:.65,Traps:.2,Forearms:.3}},
  {base:"Lat Pulldown", muscle:"Back", area:"Lats", keys:["lat pulldown","pulldown","pull down"], secondary:{Biceps:.5,Shoulders:.25,Traps:.2,Forearms:.2}},
  {base:"Single-arm Lat Pulldown", muscle:"Back", area:"Lats", keys:["single arm lat pulldown","one arm lat pulldown","single-arm pulldown"], secondary:{Biceps:.45,Shoulders:.25,Traps:.2,Forearms:.2}},
  {base:"Straight-arm Pulldown", muscle:"Back", area:"Lats", keys:["straight arm pulldown","straight-arm pulldown","cable pullover"], secondary:{Triceps:.15}},
  {base:"Cable Rows", muscle:"Back", area:"Mid back / lats", keys:["row","rows","cable row","seated row"], secondary:{Biceps:.5,Traps:.35,Shoulders:.25,Forearms:.2}},
  {base:"High Cable Row", muscle:"Back", area:"Upper back", keys:["high cable row","face away cable row","upper cable row"], secondary:{Biceps:.45,Traps:.45,Shoulders:.35,Forearms:.2}},
  {base:"Single-arm Cable Row", muscle:"Back", area:"Mid back / lats", keys:["single arm cable row","one arm cable row","single-arm cable row"], secondary:{Biceps:.5,Traps:.35,Shoulders:.25,Forearms:.2}},
  {base:"Dumbbell Row", muscle:"Back", area:"Mid back / lats", keys:["dumbbell row","db row","single arm row","one arm row"], secondary:{Biceps:.5,Traps:.35,Shoulders:.25,Forearms:.25}},
  {base:"Barbell Row", muscle:"Back", area:"Mid back / lats", keys:["barbell row","pendlay row","bent over row"], secondary:{Biceps:.5,Traps:.4,Shoulders:.25,Forearms:.25}},
  {base:"Machine Row", muscle:"Back", area:"Mid back / lats", keys:["machine row","chest supported row","t bar row","t-bar row"], secondary:{Biceps:.45,Traps:.35,Shoulders:.25,Forearms:.15}},

  {base:"Overhead Press", muscle:"Shoulders", area:"Front delts", keys:["overhead press","ohp","shoulder press","military press"], secondary:{Triceps:.4,Chest:.15,Traps:.15}},
  {base:"Dumbbell Shoulder Press", muscle:"Shoulders", area:"Front delts", keys:["dumbbell shoulder press","db shoulder press","seated dumbbell press"], secondary:{Triceps:.4}},
  {base:"Arnold Press", muscle:"Shoulders", area:"Front delts", keys:["arnold press"], secondary:{Triceps:.35}},
  {base:"Pike Pushups", muscle:"Shoulders", area:"Front delts", keys:["pike pushup","pike push-up","pike push up"], secondary:{Triceps:.4,Chest:.15,Core:.15}},
  {base:"Lateral Raises", muscle:"Shoulders", area:"Side delts - lower path", keys:["lateral raise","lateral raises","side raise","side delt"], secondary:{Traps:.2}},
  {base:"Cable Lateral Raise", muscle:"Shoulders", area:"Side delts - lower path", keys:["cable lateral raise","single arm lateral raise","leaning lateral raise"], secondary:{Traps:.15}},
  {base:"Behind-the-back Cable Lateral Raise", muscle:"Shoulders", area:"Side delts - lower path", keys:["behind back cable lateral raise","behind-the-back lateral raise"], secondary:{Traps:.1}},
  {base:"Machine Lateral Raise", muscle:"Shoulders", area:"Side delts - lower path", keys:["machine lateral raise"], secondary:{Traps:.15}},
  /* ROM variants: upper-trap share grows with elevation angle (scapular
     upward rotation), so partials above/below shoulder height split differently. */
  {base:"Lateral Raise - Lower Path", muscle:"Shoulders", area:"Side delts - lower path", keys:["lateral raise lower path","lower path lateral raise","lateral raise lower","bottom half lateral raise","partial lateral raise","lateral raise to shoulder"], secondary:{Traps:.1}},
  {base:"Lateral Raise - Upper Path", muscle:"Shoulders", area:"Side delts - upper path", keys:["lateral raise upper path","upper path lateral raise","lateral raise upper","top half lateral raise","lateral raise top"], secondary:{Traps:.4}},
  {base:"Lateral Raise - Full Range", muscle:"Shoulders", area:"Side delts - full range", keys:["full range lateral raise","full rom lateral raise","lateral raise full","overhead lateral raise","full lateral raise","lateral raise overhead"], secondary:{Traps:.35}},
  {base:"Cable Y Raise", muscle:"Shoulders", area:"Side delts - upper path", keys:["cable y raise","y raise","cable y-raise"], secondary:{Traps:.3}},
  {base:"Cable Front Raise", muscle:"Shoulders", area:"Front delts", keys:["cable front raise"], secondary:{Chest:.1}},
  {base:"Cable Rear Delt Fly", muscle:"Shoulders", area:"Rear delts / upper back", keys:["cable rear delt fly","rear delt cable fly","cable reverse fly"], secondary:{Back:.25,Traps:.2}},
  {base:"Rear Delt Fly", muscle:"Shoulders", area:"Rear delts / upper back", keys:["rear delt fly","reverse fly","reverse pec deck"], secondary:{Back:.25,Traps:.2}},
  {base:"Face Pulls", muscle:"Shoulders", area:"Rear delts / upper back", keys:["face pull","rear delt","rear delts"], secondary:{Back:.3,Traps:.25}},
  {base:"Front Raise", muscle:"Shoulders", area:"Front delts", keys:["front raise","plate raise"], secondary:{Chest:.1}},

  {base:"Shrugs", muscle:"Traps", area:"Upper traps", keys:["shrug","shrugs"], secondary:{Forearms:.15}},
  {base:"Dumbbell Shrugs", muscle:"Traps", area:"Upper traps", keys:["dumbbell shrug","db shrug"], secondary:{Forearms:.15}},
  {base:"Barbell Shrugs", muscle:"Traps", area:"Upper traps", keys:["barbell shrug"], secondary:{Forearms:.15}},
  {base:"Trap Bar Shrugs", muscle:"Traps", area:"Upper traps", keys:["trap bar shrug","hex bar shrug"], secondary:{Forearms:.2}},
  {base:"Cable Shrugs", muscle:"Traps", area:"Upper traps", keys:["cable shrug","cable shrugs"], secondary:{Forearms:.15}},
  {base:"Farmer Carries", muscle:"Traps", area:"Upper traps", keys:["farmer carry","farmers carry","farmer walk","farmers walk"], secondary:{Forearms:.75,Core:.25,Calves:.1}},
  {base:"Upright Rows", muscle:"Traps", area:"Upper traps", keys:["upright row","upright rows"], secondary:{Shoulders:.55,Biceps:.2,Forearms:.15}},

  {base:"Biceps Curls", muscle:"Biceps", area:"Biceps", keys:["bicep curl","biceps curl","curl","curls","bayesian curl","cable curl"], secondary:{Forearms:.2}},
  {base:"Cable Curl", muscle:"Biceps", area:"Biceps", keys:["standing cable curl","single arm cable curl","one arm cable curl"], secondary:{Forearms:.2}},
  {base:"Bayesian Cable Curl", muscle:"Biceps", area:"Biceps", keys:["bayesian cable curl","bayesian curl"], secondary:{Forearms:.15}},
  {base:"Hammer Curl", muscle:"Biceps", area:"Biceps", keys:["hammer curl","neutral grip curl"], secondary:{Forearms:.45}},
  {base:"Rope Hammer Curl", muscle:"Biceps", area:"Biceps", keys:["rope hammer curl","cable hammer curl"], secondary:{Forearms:.45}},
  {base:"Incline Dumbbell Curl", muscle:"Biceps", area:"Biceps", keys:["incline curl","incline dumbbell curl"], secondary:{Forearms:.15}},
  {base:"Preacher Curl", muscle:"Biceps", area:"Biceps", keys:["preacher curl","machine curl"], secondary:{Forearms:.15}},
  {base:"Concentration Curl", muscle:"Biceps", area:"Biceps", keys:["concentration curl"], secondary:{Forearms:.1}},
  {base:"EZ Bar Curl", muscle:"Biceps", area:"Biceps", keys:["ez curl","ez bar curl","barbell curl"], secondary:{Forearms:.2}},

  {base:"Triceps Pulldown", muscle:"Triceps", area:"Lateral / medial head", keys:["tricep pulldown","triceps pulldown","tricep pushdown","triceps pushdown","pushdown"], secondary:{}},
  {base:"Triceps Overhead Extension", muscle:"Triceps", area:"Triceps long head", keys:["overhead tricep","overhead triceps","overhead extension"], secondary:{}},
  {base:"Overhead Cable Triceps Extension", muscle:"Triceps", area:"Triceps long head", keys:["overhead cable tricep","overhead cable triceps","cable overhead extension"], secondary:{}},
  {base:"Crossbody Cable Triceps Extension", muscle:"Triceps", area:"Lateral / medial head", keys:["crossbody tricep","crossbody triceps","cross body cable triceps"], secondary:{}},
  {base:"Single-arm Cable Pushdown", muscle:"Triceps", area:"Lateral / medial head", keys:["single arm pushdown","single-arm pushdown","one arm tricep pushdown"], secondary:{}},
  {base:"Skull Crushers", muscle:"Triceps", area:"Triceps long head", keys:["skull crusher","skullcrusher","lying tricep extension","lying triceps extension"], secondary:{}},
  {base:"Close-grip Bench Press", muscle:"Triceps", area:"Lateral / medial head", keys:["close grip bench","close-grip bench","close grip press"], secondary:{Chest:.35,Shoulders:.25}},
  {base:"Bench Dips", muscle:"Triceps", area:"Lateral / medial head", keys:["bench dip","bench dips","tricep dip","triceps dip"], secondary:{Chest:.25,Shoulders:.25}},
  {base:"Triceps Kickback", muscle:"Triceps", area:"Lateral / medial head", keys:["kickback","tricep kickback","triceps kickback"], secondary:{}},
  {base:"Cable Triceps Kickback", muscle:"Triceps", area:"Lateral / medial head", keys:["cable tricep kickback","cable triceps kickback"], secondary:{}},
  {base:"Diamond Pushups", muscle:"Triceps", area:"Lateral / medial head", keys:["diamond pushup","diamond push-up","diamond push up","triangle pushup"], secondary:{Chest:.35,Shoulders:.25,Core:.1}},
  {base:"Sphinx Pushups", muscle:"Triceps", area:"Triceps long head", keys:["sphinx pushup","sphinx push-up","sphinx push up"], secondary:{Shoulders:.35,Chest:.2,Core:.15}},

  {base:"Wrist Curl", muscle:"Forearms", area:"Forearms", keys:["wrist curl","wrist curls"], secondary:{}},
  {base:"Reverse Wrist Curl", muscle:"Forearms", area:"Forearms", keys:["reverse wrist curl","wrist extension"], secondary:{}},
  {base:"Reverse Curl", muscle:"Forearms", area:"Forearms", keys:["reverse curl","reverse curls"], secondary:{Biceps:.35}},
  {base:"Plate Pinch", muscle:"Forearms", area:"Forearms", keys:["plate pinch","pinch grip"], secondary:{}},
  {base:"Wrist Roller", muscle:"Forearms", area:"Forearms", keys:["wrist roller"], secondary:{Shoulders:.1}},
  {base:"Dead Hang", muscle:"Forearms", area:"Forearms", keys:["dead hang","bar hang"], secondary:{Back:.2,Traps:.15}},

  {base:"Squats", muscle:"Quads", area:"Quads / glutes", keys:["squat","squats","back squat","cable squat"], secondary:{Glutes:.5,Hamstrings:.1,Calves:.1}},
  {base:"Front Squat", muscle:"Quads", area:"Quads / glutes", keys:["front squat"], secondary:{Glutes:.35,Core:.25,Calves:.1}},
  {base:"Leg Press", muscle:"Quads", area:"Quads / glutes", keys:["leg press"], secondary:{Glutes:.45,Hamstrings:.1,Calves:.1}},
  {base:"Hack Squat", muscle:"Quads", area:"Quads / glutes", keys:["hack squat","pendulum squat"], secondary:{Glutes:.35,Hamstrings:.1,Calves:.1}},
  {base:"Leg Extension", muscle:"Quads", area:"Quads / glutes", keys:["leg extension","quad extension"], secondary:{}},
  {base:"Bulgarian Split Squat", muscle:"Quads", area:"Quads / glutes", keys:["bulgarian split squat","split squat"], secondary:{Glutes:.5,Hamstrings:.2,Core:.15}},
  {base:"Lunges", muscle:"Quads", area:"Quads / glutes", keys:["lunge","lunges","reverse lunge","walking lunge"], secondary:{Glutes:.5,Hamstrings:.2,Calves:.1}},
  {base:"Step-ups", muscle:"Quads", area:"Quads / glutes", keys:["step up","step-up","step ups","step-ups"], secondary:{Glutes:.45,Hamstrings:.15,Calves:.15}},

  {base:"Leg Curls", muscle:"Hamstrings", area:"Hamstrings", keys:["leg curl","leg curls","hamstring curl","ham curls"], secondary:{Glutes:.1}},
  {base:"Seated Leg Curl", muscle:"Hamstrings", area:"Hamstrings", keys:["seated leg curl"], secondary:{Glutes:.1}},
  {base:"Lying Leg Curl", muscle:"Hamstrings", area:"Hamstrings", keys:["lying leg curl","prone leg curl"], secondary:{Glutes:.1}},
  {base:"Romanian Deadlift", muscle:"Hamstrings", area:"Hamstrings", keys:["romanian deadlift","rdl","deadlift"], secondary:{Glutes:.45,Back:.2,Traps:.1,Forearms:.25}},
  {base:"Stiff-leg Deadlift", muscle:"Hamstrings", area:"Hamstrings", keys:["stiff leg deadlift","stiff-legged deadlift","sldl"], secondary:{Glutes:.4,Back:.2,Traps:.1,Forearms:.25}},
  {base:"Good Morning", muscle:"Hamstrings", area:"Hamstrings", keys:["good morning","good mornings"], secondary:{Glutes:.35,Back:.25}},
  {base:"Nordic Ham Curl", muscle:"Hamstrings", area:"Hamstrings", keys:["nordic curl","nordic ham curl","nordic hamstring"], secondary:{Glutes:.1,Core:.15}},
  {base:"Glute-Ham Raise", muscle:"Hamstrings", area:"Hamstrings", keys:["glute ham raise","ghr"], secondary:{Glutes:.25,Core:.15}},

  {base:"Hip Thrust", muscle:"Glutes", area:"Quads / glutes", keys:["hip thrust","machine hip thrust"], secondary:{Hamstrings:.25,Quads:.1}},
  {base:"Glute Bridge", muscle:"Glutes", area:"Quads / glutes", keys:["glute bridge","bridge"], secondary:{Hamstrings:.25,Core:.15}},
  {base:"Cable Kickback", muscle:"Glutes", area:"Quads / glutes", keys:["cable kickback","glute kickback","kick back"], secondary:{Hamstrings:.15}},
  {base:"Cable Pull-through", muscle:"Glutes", area:"Quads / glutes", keys:["cable pull through","cable pull-through"], secondary:{Hamstrings:.35,Back:.15}},
  {base:"Hip Abduction", muscle:"Glutes", area:"Quads / glutes", keys:["hip abduction","abductor","band walk","lateral band walk"], secondary:{}},
  {base:"Frog Pumps", muscle:"Glutes", area:"Quads / glutes", keys:["frog pump","frog pumps"], secondary:{Hamstrings:.1}},
  {base:"Glute-biased Back Extension", muscle:"Glutes", area:"Quads / glutes", keys:["back extension","45 degree back extension","glute back extension"], secondary:{Hamstrings:.35,Back:.2}},

  {base:"Calf Raises", muscle:"Calves", area:"Calves", keys:["calf raise","calf raises","standing calf raise"], secondary:{}},
  {base:"Seated Calf Raise", muscle:"Calves", area:"Calves", keys:["seated calf raise"], secondary:{}},
  {base:"Single-leg Calf Raise", muscle:"Calves", area:"Calves", keys:["single leg calf raise","single-leg calf raise"], secondary:{}},
  {base:"Donkey Calf Raise", muscle:"Calves", area:"Calves", keys:["donkey calf raise"], secondary:{}},
  {base:"Leg Press Calf Raise", muscle:"Calves", area:"Calves", keys:["leg press calf raise","calf press"], secondary:{}},
  {base:"Pogo Hops", muscle:"Calves", area:"Calves", keys:["pogo hop","pogo hops","jump rope","skipping"], secondary:{Core:.1}},

  {base:"Core", muscle:"Core", area:"Core", keys:["core"], secondary:{}},
  {base:"Plank", muscle:"Core", area:"Core", keys:["plank","front plank"], secondary:{Shoulders:.1}},
  {base:"Side Plank", muscle:"Core", area:"Core", keys:["side plank"], secondary:{Shoulders:.1,Glutes:.1}},
  {base:"Cable Crunch", muscle:"Core", area:"Core", keys:["cable crunch","kneeling crunch"], secondary:{}},
  {base:"Cable Woodchop", muscle:"Core", area:"Core", keys:["cable woodchop","woodchop","cable chop"], secondary:{Shoulders:.1}},
  {base:"Crunch", muscle:"Core", area:"Core", keys:["crunch","crunches"], secondary:{}},
  {base:"Sit-up", muscle:"Core", area:"Core", keys:["situp","sit-up","sit up"], secondary:{}},
  {base:"Hanging Leg Raise", muscle:"Core", area:"Core", keys:["hanging leg raise","leg raise","leg raises","hanging knee raise"], secondary:{Forearms:.25}},
  {base:"Ab Wheel Rollout", muscle:"Core", area:"Core", keys:["ab wheel","rollout","ab rollout"], secondary:{Shoulders:.15,Back:.1}},
  {base:"Russian Twist", muscle:"Core", area:"Core", keys:["russian twist","twist"], secondary:{}},
  {base:"Pallof Press", muscle:"Core", area:"Core", keys:["pallof press","anti rotation"], secondary:{Shoulders:.1}},
];
function normName(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function taxonomyMatch(name){
  const raw=(name||'').trim();
  const n=' '+normName(raw)+' ';
  let best=null;
  EXERCISE_TAXONOMY.forEach(x=>{
    x.keys.forEach(k=>{
      const nk=normName(k);
      if(!nk) return;
      const hit=n.includes(' '+nk+' ') || n.includes(nk);
      if(!hit) return;
      const score=nk.length+(n.trim()===nk?50:0);
      if(!best||score>best.score) best={...x,score,confidence:n.trim()===nk?'exact':'partial'};
    });
  });
  return best;
}
function exerciseMatch(name){
  const raw=(name||'').trim();
  const tax=taxonomyMatch(raw);
  const exact=NAME_MUSCLE[raw]&&{base:raw,muscle:NAME_MUSCLE[raw],area:NAME_AREA[raw]||NAME_MUSCLE[raw],secondary:{...(tax?.secondary||{})},confidence:'exact',matchedBase:tax?.base||raw,keys:tax?.keys||[]};
  if(exact) return exact;
  return tax;
}
function guessMuscle(name){ return exerciseMatch(name)?.muscle||''; }
const muscleOf=ex=>ex.muscle||guessMuscle(ex.name)||'';
function guessArea(name){ return exerciseMatch(name)?.area||''; }
const areaOf=ex=>ex.area||guessArea(ex.name)||muscleOf(ex)||'Other';
const pplOf=ex=>AREA_PPL[areaOf(ex)]||MUSCLE_PPL[muscleOf(ex)]||'Other';
/* Recommended weekly sets per muscle, by training-week intensity tier.
   Grounded in hypertrophy volume literature (Schoenfeld et al.; Renaissance
   Periodization MV/MEV/MAV landmarks, current as of 2026):
   - maintain ≈ Maintenance Volume (keep what you have on a light week)
   - build    ≈ MEV→MAV growth zone (the app's long-standing default)
   - beast    ≈ upper MAV — high but still recoverable productive volume */
const REC_SETS_TIERS={
  maintain:{ Chest:4, Back:4, Shoulders:3, Traps:2, Biceps:3, Triceps:3,
    Forearms:2, Quads:4, Hamstrings:3, Glutes:3, Calves:3, Core:2, Other:3 },
  build:{ Chest:8, Back:8, Shoulders:6, Traps:4, Biceps:6, Triceps:6,
    Forearms:4, Quads:8, Hamstrings:6, Glutes:6, Calves:6, Core:4, Other:6 },
  beast:{ Chest:14, Back:14, Shoulders:12, Traps:8, Biceps:12, Triceps:12,
    Forearms:8, Quads:14, Hamstrings:12, Glutes:12, Calves:10, Core:8, Other:12 }
};
function secondaryMuscles(ex){
  if(ex.secondary&&Object.keys(ex.secondary).length) return {...ex.secondary};
  if(ex.match?.secondary&&Object.keys(ex.match.secondary).length) return {...ex.match.secondary};
  const name=(ex.name||'').toLowerCase();
  const m=muscleOf(ex)||'Other';
  const area=areaOf(ex)||'';
  const matched=exerciseMatch(ex.name);
  if(matched?.secondary&&Object.keys(matched.secondary).length) return {...matched.secondary};
  const out={};
  const add=(muscle,weight)=>{ if(muscle&&muscle!==m) out[muscle]=(out[muscle]||0)+weight; };
  if(m==='Back'){
    add('Biceps',0.5); add('Traps',name.includes('row')?0.35:0.2);
    add('Forearms',/chin|pull.?up/.test(name)?0.3:0.2);
    if(area.includes('Upper back')) add('Shoulders',0.25);
  }
  if(m==='Chest'){
    add('Triceps',name.includes('dip')?0.65:0.45);
    add('Shoulders',name.includes('dip')?0.25:0.35);
  }
  if(m==='Shoulders'){
    if(name.includes('press')||area==='Front delts') add('Triceps',0.4);
    if(name.includes('face pull')||area.includes('Rear delts')){ add('Back',0.3); add('Traps',0.25); }
  }
  if(m==='Triceps'&&name.includes('dip')) add('Chest',0.5);
  if(m==='Quads'){ add('Glutes',0.5); if(name.includes('squat')||name.includes('lunge')) add('Hamstrings',0.2); }
  if(m==='Hamstrings'){ add('Glutes',0.25); }
  if(m==='Glutes'){ add('Hamstrings',0.25); add('Quads',0.2); }
  return out;
}
function fmtEff(n){ return Number.isInteger(n)?String(n):(Number.isInteger(n*10)?n.toFixed(1):n.toFixed(2).replace(/0$/,'')); }
function inferredExerciseNote(ex){
  const match=exerciseMatch(ex.name);
  if(!match||match.confidence==='exact') return '';
  return `Counting as <b>${esc(match.base)}</b> for muscle tracking.`;
}
