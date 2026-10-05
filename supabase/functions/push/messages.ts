// Generuje scripts/build-push-messages.mjs z messages/*.json. Needitovat ručně.

export const MESSAGES = {
  "cs": {
    "variants": {
      "O1": {
        "title": "Série {lost} dní spadla 💔",
        "body": "Ještě ji můžeš obnovit, ale jen {deadline, select, today {do dnešní půlnoci} other {do zítřejší půlnoci}}. Pak už nadobro."
      },
      "O2": {
        "title": "{lost} dní práce v koši? 🗑️",
        "body": "Ne tak rychle. Sérii jde obnovit {deadline, select, today {do dnešní půlnoci} other {do zítřejší půlnoci}}. Pak se začíná od nuly."
      },
      "O3": {
        "title": "Resuscitace série 🫀",
        "body": "Série {lost} dní ještě není ztracená. Obnovit ji můžeš {deadline, select, today {do dnešní půlnoci} other {do zítřejší půlnoci}}."
      },
      "M1": {
        "title": "Dnes to bude týden 🏅",
        "body": "Ještě jedna lekce a odznak za 7 dní v kuse je tvůj. Teď by byla škoda couvnout."
      },
      "M2": {
        "title": "6 dní máš, sedmý chybí 🏅",
        "body": "Týden v kuse je první odznak série. Dávkování: jedna lekce, ještě dnes."
      },
      "M3": {
        "title": "Dnes 30. den 🏅",
        "body": "Měsíc v kuse. Takovou adherenci by ti záviděla každá ambulance."
      },
      "M4": {
        "title": "29 dní. Chybí jeden 🏅",
        "body": "Od odznaku za měsíc v kuse tě dělí jediná lekce. Pět minut a můžeš se chlubit."
      },
      "M5": {
        "title": "Den 100 🏆",
        "body": "Stovka. Jedna lekce a jsi tam, kam se skoro nikdo nedostane."
      },
      "M6": {
        "title": "99 dní v kuse 🏆",
        "body": "Tři cifry na dosah. Jedna lekce a série má poprvé stovku."
      },
      "R1": {
        "title": "Rekord na dosah 📈",
        "body": "{days, plural, one {# den} few {# dny} other {# dní}} je tvoje maximum. Dnešní lekce ho přepíše. Nebo taky ne, to je na tobě."
      },
      "R2": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}}, osobní maximum 📈",
        "body": "Den {next} by byl nový rekord. Stačí sedm příkladů."
      },
      "R3": {
        "title": "Nový rekord čeká 📈",
        "body": "Tvoje nejdelší série je dlouhá přesně jako ta dnešní. Jedna lekce a je delší."
      },
      "R4": {
        "title": "Den {next}? Ten tu ještě nebyl 📈",
        "body": "Neprobádané území. Dnešní lekce z něj udělá nový rekord."
      },
      "D1": {
        "title": "{handle} čeká na tvůj tah ⚔️",
        "body": "Rozehraný souboj a nedotčená série. Dnes máš co dohánět."
      },
      "D2": {
        "title": "Souboj s {handle} pořád čeká ⚔️",
        "body": "Soupeř nečeká věčně a série taky ne. Začni, čím chceš."
      },
      "L1": {
        "title": "Na postup chybí {gap} XP 📊",
        "body": "Lekce bez chyby dává 90 XP. Zbytek je trojčlenka."
      },
      "L2": {
        "title": "{rank}. místo. Hmm 📊",
        "body": "Do postupové trojky ti chybí {gap} XP. Ostatní mezitím počítají."
      },
      "L3": {
        "title": "Sestupová zóna ⬇️",
        "body": "Do bezpečí chybí {safe} XP. Jedna lekce dá až 90."
      },
      "L4": {
        "title": "Liga ti ujíždí ⬇️",
        "body": "Jsi {rank}. a padáš. {safe} XP a jsi z toho venku."
      },
      "L5": {
        "title": "{rank}. místo a postup 🏆",
        "body": "Pozice drží, dokud ostatní spí. Oni ale nespí."
      },
      "L6": {
        "title": "Postupová trojka 🏆",
        "body": "Jsi v ní. Jedna dnešní lekce a bude se tě hůř dohánět."
      },
      "F1": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse 🔥",
        "body": "Ochranu série máš. Ale pojistka není léčba, jen pojistka."
      },
      "F2": {
        "title": "Ochrana na skladě 🛡️",
        "body": "Neznamená to, že ji dnes musíš použít. Sedm příkladů a zůstane netknutá."
      },
      "F3": {
        "title": "Spoléháš na ochranu? 🛡️",
        "body": "Ta stojí 60 pastilek. Lekce je zadarmo a ještě ti nějaké přidá."
      },
      "N1": {
        "title": "Dnešní dávka čeká 💊",
        "body": "Nula dní v kuse. Nejlepší číslo na začátek, horší na konec."
      },
      "N2": {
        "title": "Čistý list 📋",
        "body": "Dnes se píše první den nové série. Pero máš ty."
      },
      "N3": {
        "title": "Den 1 začíná dnes 💊",
        "body": "Nebo zítra. Nebo pozítří. Nebo prostě teď, za pět minut je hotovo."
      },
      "N4": {
        "title": "Mililitry se samy nespočítají 💉",
        "body": "Série je na nule. Jedna lekce a je na jedničce."
      },
      "N5": {
        "title": "Nová série, nová šance 💊",
        "body": "Sedm příkladů a máš první den. Ten nejtěžší je vždycky ten první."
      },
      "A1": {
        "title": "Ranní dávka 💊",
        "body": "Nalačno, před snídaní, sedm příkladů. Den {next} série čeká."
      },
      "A2": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse ☕",
        "body": "Káva a jedna lekce. Pak si celý den můžeš dělat, co chceš."
      },
      "A3": {
        "title": "Ranní vizita 🩺",
        "body": "Série: {days, plural, one {# den} few {# dny} other {# dní}}, stav stabilizovaný. Doporučení: jedna lekce ještě dopoledne."
      },
      "A4": {
        "title": "Dobré ráno, {days, plural, one {# den} few {# dny} other {# dní}} 🔥",
        "body": "Ráno spočítáno, večer volno. Jednoduchá trojčlenka."
      },
      "P1": {
        "title": "Polední pauza? 🥪",
        "body": "Sedm příkladů se vejde mezi polévku a hlavní chod. Série {days} dní ti poděkuje."
      },
      "P2": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse 🔥",
        "body": "Odpolední útlum se léčí. Třeba trojčlenkou."
      },
      "P3": {
        "title": "Odpolední ordinace 🩺",
        "body": "Pacient: tvoje série. Diagnóza: akutní nedostatek příkladů. Terapie: jedna lekce."
      },
      "P4": {
        "title": "Půlka dne je pryč ⏱️",
        "body": "Série {days} dní zatím nic nedostala. Napravíš to za pět minut."
      },
      "V1": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse 🔥",
        "body": "Seriál počká. Série ne."
      },
      "V2": {
        "title": "Večerní dávka 💊",
        "body": "Jedna lekce před spaním. Vedlejší účinky: dobrý pocit a delší série."
      },
      "V3": {
        "title": "Dnes zatím nula příkladů 🌙",
        "body": "Série {days} dní to vidí. A trochu se bojí."
      },
      "V4": {
        "title": "Služba končí, série ne 🌙",
        "body": "Pět minut na gauči a den {next} je zapsaný."
      },
      "W1": {
        "title": "Víkend není výmluva 🔥",
        "body": "Série {days} dní nezná volno. Pět minut a máš ho celé."
      },
      "W2": {
        "title": "Víkendová služba 🩺",
        "body": "Žádná vizita, žádný seminář. Jen sedm příkladů a den {next} série."
      },
      "W3": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse ☀️",
        "body": "Brunch, výlet, cokoli. Ale nejdřív lekce, ať máš čisté svědomí."
      },
      "W4": {
        "title": "Víkend na gauči 🛋️",
        "body": "Ideální poloha na sedm příkladů. Série {days} dní souhlasí."
      },
      "X1": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse 🔥",
        "body": "Dávkování: jedna lekce denně. Nepřekračovat? Klidně překroč."
      },
      "X2": {
        "title": "Recept na dnešek 📝",
        "body": "Rp. Lekce č. I. S. jednou denně, nejlépe hned."
      },
      "X3": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse 🔥",
        "body": "Série je jako kytka. Taky nemá ráda, když na ni zapomeneš."
      },
      "X4": {
        "title": "Tvoje série tu pořád je 👀",
        "body": "{days, plural, one {# den} few {# dny} other {# dní}}. A nehodlá se nechat zapomenout."
      },
      "X5": {
        "title": "Mililitry se samy nespočítají 💉",
        "body": "Zkoušeli jsme to. Fakt ne. Série {days} dní čeká na tebe."
      },
      "X6": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}} v kuse 🔥",
        "body": "Sedm příkladů, pět minut, nula výmluv."
      },
      "X7": {
        "title": "Indikace: dnešek 📋",
        "body": "Kontraindikace: žádné. Doporučená dávka: jedna lekce."
      },
      "X8": {
        "title": "Platí to mezi vámi? 💍",
        "body": "Ty a série {days} dní. Odpověď stačí v podobě lekce."
      },
      "X9": {
        "title": "Gtt/min se samy nespočítají 💧",
        "body": "Kapky za minutu, mg na kilo, ml za hodinu. Dnes stačí sedm z nich."
      },
      "X11": {
        "title": "Malá připomínka 💊",
        "body": "Série {days} dní se neudrží sama. Teda udrží, ale jen do půlnoci."
      },
      "X12": {
        "title": "Jedna tableta denně 💊",
        "body": "Tedy lekce. Polyká se líp, než vypadá. Den {next} čeká."
      },
      "C1": {
        "title": "Ochrana série v ohrožení 🛡️",
        "body": "Do půlnoci jedna lekce, jinak ji série dnes spotřebuje."
      },
      "C2": {
        "title": "Série {days} dní zatím přežije ⏳",
        "body": "Díky ochraně. Ta ale stojí 60 pastilek a dnešní lekce nic. Do půlnoci."
      },
      "C3": {
        "title": "{days} dní na jednom vlásku ⏳",
        "body": "Tolik práce a rozhodne o ní dnešní večer. Do půlnoci stačí jedna lekce."
      },
      "C4": {
        "title": "Poslední výzva pro {days} dní 📢",
        "body": "Půlnoc se blíží, lekce trvá pět minut. Spočítej si to."
      },
      "C5": {
        "title": "Série {days} dní na kapačce 💧",
        "body": "Životní funkce slábnou. Jedna lekce do půlnoci ji postaví na nohy."
      },
      "C6": {
        "title": "Série dlouhá {days, plural, one {# den} few {# dny} other {# dní}} visí na vlásku ⏳",
        "body": "Do půlnoci stačí jedna lekce. Zvládneš to."
      },
      "C7": {
        "title": "Tik ťak ⏳",
        "body": "Série {days} dní končí o půlnoci. Pokud tedy dnes nespočítáš lekci."
      },
      "C8": {
        "title": "Tohle je ta zpráva, kterou nechceš 😬",
        "body": "Série {days} dní dnes padne. Jestli tedy do půlnoci nespočítáš jednu lekci."
      },
      "C9": {
        "title": "{days, plural, one {# den} few {# dny} other {# dní}}, nebo nula? ⏳",
        "body": "Rozhoduje se dnes do půlnoci. Lekce trvá pět minut."
      },
      "C10": {
        "title": "Ještě nespíš? 🌙",
        "body": "Výborně. Série {days} dní taky ne, čeká na jednu lekci do půlnoci."
      },
      "DC1": {
        "title": "⚔️ Výzva na souboj",
        "body": "{handle} tě vyzývá. Přijmi do 48 hodin, jinak výzva propadne."
      },
      "DC2": {
        "title": "{handle} tě vyzývá ⚔️",
        "body": "Sedm stejných příkladů, kdo víc, ten vyhrává. Na přijetí máš 48 hodin."
      },
      "DC3": {
        "title": "Rukavice hozena 🧤",
        "body": "{handle} chce souboj. Zvedneš ji? Výzva platí 48 hodin."
      },
      "DC4": {
        "title": "Někdo si na tebe věří ⚔️",
        "body": "Konkrétně {handle}. Výzva platí 48 hodin."
      },
      "PO1": {
        "title": "Výzva čeká 👀",
        "body": "{handle} má odehráno a čeká, jestli souboj přijmeš."
      },
      "PO2": {
        "title": "{handle} už má odehráno 👀",
        "body": "Teď je to na tobě. Přijmeš, nebo necháš výzvu propadnout?"
      },
      "PO3": {
        "title": "Skóre je zapečetěné 🔒",
        "body": "{handle} má odehráno. Výsledek uvidíš, až souboj přijmeš a dohraješ."
      },
      "PT1": {
        "title": "Jsi na tahu 👀",
        "body": "{handle} má odehráno. Skóre uvidíš, až dohraješ."
      },
      "PT2": {
        "title": "Tvůj tah ⚔️",
        "body": "{handle} má hotovo. Ty ještě ne. Jen konstatujeme."
      },
      "PT3": {
        "title": "Obálka s výsledkem čeká ✉️",
        "body": "Otevře se, až dohraješ souboj s {handle}."
      },
      "DA1": {
        "title": "Souboj přijat ⚔️",
        "body": "{handle} jde do toho. Oba máte 48 hodin na dohrání."
      },
      "DA2": {
        "title": "{handle} jde do toho ⚔️",
        "body": "Výzva přijata. Teď už není cesty zpět. 48 hodin."
      },
      "DA3": {
        "title": "Je to oficiální ⚔️",
        "body": "Souboj s {handle} běží. Sedm příkladů, 48 hodin, žádné výmluvy."
      },
      "DD1": {
        "title": "Výzva odmítnuta",
        "body": "{handle} tentokrát nehraje. Nic se nepočítá, zkus to jindy."
      },
      "DD2": {
        "title": "Tentokrát ne 🤷",
        "body": "{handle} souboj nepřijímá. Nic se neděje, ani nepočítá."
      },
      "DD3": {
        "title": "Souboj se nekoná",
        "body": "{handle} tentokrát pasuje. Vyzvat jde i někoho jiného."
      },
      "DE1": {
        "title": "Souboj končí za 6 hodin ⏳",
        "body": "Dohraj souboj s {handle}, jinak prohraješ kontumačně."
      },
      "DE2": {
        "title": "6 hodin do kontumace ⏳",
        "body": "Souboj s {handle} čeká na tvých sedm příkladů."
      },
      "DE3": {
        "title": "Kontumace na obzoru 🏳️",
        "body": "Za 6 hodin propadá souboj s {handle}. Prohrát bez boje je škoda."
      },
      "FW1": {
        "title": "Vítězství! 🏆",
        "body": "Souboj s {handle} skončil {mine}:{theirs}."
      },
      "FW2": {
        "title": "{mine}:{theirs} pro tebe 🏆",
        "body": "Souboj s {handle} je tvůj. +15 pastilek."
      },
      "FW3": {
        "title": "Výhra 🏆",
        "body": "Souboj s {handle} skončil {mine}:{theirs}. Pěkně spočítáno."
      },
      "FW4": {
        "title": "Vítězství se počítá 🏆",
        "body": "{mine}:{theirs} v souboji s {handle}. Odveta asi na sebe nenechá dlouho čekat."
      },
      "FL1": {
        "title": "Tentokrát prohra",
        "body": "Souboj s {handle} skončil {mine}:{theirs}. Odveta?"
      },
      "FL2": {
        "title": "{mine}:{theirs}. Odveta? ⚔️",
        "body": "Souboj s {handle} tentokrát nevyšel. Příště se počítá znovu."
      },
      "FL3": {
        "title": "Tohle kolo pro {handle}",
        "body": "{mine}:{theirs}. Kola se ale dají opakovat. Stačí vyzvat zpátky."
      },
      "FD1": {
        "title": "Remíza 🤝",
        "body": "Souboj s {handle} skončil {mine}:{theirs}."
      },
      "FD2": {
        "title": "{mine}:{theirs}, remíza 🤝",
        "body": "S {handle} jste si kvit. +5 pastilek a důvod k odvetě."
      },
      "FP1": {
        "title": "7:7, dokonalá remíza 🤝",
        "body": "S {handle} ani jedna chyba. +10 pastilek pro každého."
      },
      "FP2": {
        "title": "Bez chyby na obou stranách ✨",
        "body": "Souboj s {handle} skončil 7:7. Takhle vypadá remíza, za kterou se nestydí nikdo."
      },
      "KW1": {
        "title": "Výhra kontumačně 🏆",
        "body": "Souboj s {handle} nebyl včas dohrán. Výhra je tvoje, +15 pastilek."
      },
      "KW2": {
        "title": "Výhra bez boje 🏳️",
        "body": "Souboj s {handle} propadl a výhra připadá tobě. +15 pastilek."
      },
      "KL1": {
        "title": "Souboj propadl",
        "body": "Lhůta souboje s {handle} vypršela. Počítá se jako prohra."
      },
      "KL2": {
        "title": "48 hodin uteklo ⌛",
        "body": "Souboj s {handle} propadl a počítá se jako prohra. Příště stačí sedm příkladů včas."
      },
      "FR1": {
        "title": "Nová žádost o přátelství 👋",
        "body": "{handle} si tě chce přidat mezi kamarády."
      },
      "FR2": {
        "title": "{handle} klepe na dveře 👋",
        "body": "Chce tě mezi kamarády. Pak se můžete vyzývat na souboje."
      },
      "FR3": {
        "title": "Máš fanouška 👋",
        "body": "{handle} si tě chce přidat mezi kamarády."
      },
      "FA1": {
        "title": "Nové přátelství 🤝",
        "body": "{handle} je teď mezi kamarády. Co třeba souboj?"
      },
      "FA2": {
        "title": "{handle} je v partě 🤝",
        "body": "Žádost přijata. Kdo vyzve první?"
      },
      "FA3": {
        "title": "Přátelství potvrzeno 🤝",
        "body": "S {handle} teď navzájem vidíte série i ligu. A můžete se vyzvat."
      },
      "G1": {
        "title": "Dárek! 🎁",
        "body": "{handle} ti posílá ochranu série. Připíše se, až otevřeš aplikaci."
      },
      "G2": {
        "title": "{handle} ti kryje záda 🛡️",
        "body": "Posílá ti ochranu série. Připíše se, až otevřeš aplikaci."
      },
      "G3": {
        "title": "Balíček z lékárny 🎁",
        "body": "Od {handle}: jedna ochrana série. Vyzvedneš si ji otevřením aplikace."
      },
      "LD1": {
        "title": "Poslední den ligy 🔥",
        "body": "Jsi {rank}. a postupuješ. Udrž to!"
      },
      "LD2": {
        "title": "Postup na dosah 🏆",
        "body": "Jsi {rank}. a ligy zbývá jeden den. Neusínej na vavřínech."
      },
      "LD3": {
        "title": "Poslední den ligy 🔥",
        "body": "Jsi {rank}. a na postup chybí {gap} XP."
      },
      "LD4": {
        "title": "{gap} XP do postupu 📊",
        "body": "Dnes je poslední den ligy. Lekce bez chyby dá 90 XP."
      },
      "LD5": {
        "title": "Poslední den ligy 🔥",
        "body": "Jsi {rank}. a padáš do nižší ligy. Do bezpečí chybí {safe} XP."
      },
      "LD6": {
        "title": "Poslední šance na záchranu ⬇️",
        "body": "Jsi {rank}. a do bezpečí chybí {safe} XP. Liga dnes končí."
      },
      "LD7": {
        "title": "Poslední den ligy 🔥",
        "body": "Jsi {rank}. z {size}. Dnes ještě můžeš přidat XP."
      },
      "LD8": {
        "title": "Liga dnes končí 🔥",
        "body": "{rank}. místo z {size}. Každá lekce ještě posouvá."
      },
      "LR1": {
        "title": "Postup! 🏆",
        "body": "S {rank}. místem postupuješ do {tier}. ligy."
      },
      "LR2": {
        "title": "Vítej v {tier}. lize 🏆",
        "body": "{rank}. místo minulý týden znamená postup. Konkurence je tu tvrdší."
      },
      "LR3": {
        "title": "Týden skončil",
        "body": "S {rank}. místem sestupuješ do {tier}. ligy. Tenhle týden to můžeš otočit."
      },
      "LR4": {
        "title": "Nový týden, nová liga",
        "body": "Minulý týden {rank}. místo a sestup do {tier}. ligy. Odtud se dobře postupuje."
      },
      "LR5": {
        "title": "Nový týden ligy",
        "body": "Minulý týden {rank}. místo z {size}. Nový týden právě začíná."
      },
      "LR6": {
        "title": "Liga od nuly 🔄",
        "body": "Minulý týden {rank}. z {size}. Teď mají všichni nula XP, včetně těch nahoře."
      }
    },
    "actionLesson": "Spustit lekci"
  },
  "sk": {
    "variants": {
      "O1": {
        "title": "Séria {lost} dní spadla 💔",
        "body": "Ešte ju môžeš obnoviť, ale len {deadline, select, today {do dnešnej polnoci} other {do zajtrajšej polnoci}}. Potom už nadobro."
      },
      "O2": {
        "title": "{lost} dní práce v koši? 🗑️",
        "body": "Nie tak rýchlo. Sériu sa dá obnoviť {deadline, select, today {do dnešnej polnoci} other {do zajtrajšej polnoci}}. Potom sa začína od nuly."
      },
      "O3": {
        "title": "Resuscitácia série 🫀",
        "body": "Séria {lost} dní ešte nie je stratená. Obnoviť ju môžeš {deadline, select, today {do dnešnej polnoci} other {do zajtrajšej polnoci}}."
      },
      "M1": {
        "title": "Dnes to bude týždeň 🏅",
        "body": "Ešte jedna lekcia a odznak za 7 dní po sebe je tvoj. Teraz by bola škoda cúvnuť."
      },
      "M2": {
        "title": "6 dní máš, siedmy chýba 🏅",
        "body": "Týždeň po sebe je prvý odznak série. Dávkovanie: jedna lekcia, ešte dnes."
      },
      "M3": {
        "title": "Dnes 30. deň 🏅",
        "body": "Mesiac po sebe. Takú adherenciu by ti závidela každá ambulancia."
      },
      "M4": {
        "title": "29 dní. Chýba jeden 🏅",
        "body": "Od odznaku za mesiac po sebe ťa delí jediná lekcia. Päť minút a môžeš sa chváliť."
      },
      "M5": {
        "title": "Deň 100 🏆",
        "body": "Stovka. Jedna lekcia a si tam, kam sa skoro nikto nedostane."
      },
      "M6": {
        "title": "99 dní po sebe 🏆",
        "body": "Tri cifry na dosah. Jedna lekcia a séria má prvýkrát stovku."
      },
      "R1": {
        "title": "Rekord na dosah 📈",
        "body": "{days, plural, one {# deň} few {# dni} other {# dní}} je tvoje maximum. Dnešná lekcia ho prepíše. Alebo aj nie, to je na tebe."
      },
      "R2": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}}, osobné maximum 📈",
        "body": "Deň {next} by bol nový rekord. Stačí sedem príkladov."
      },
      "R3": {
        "title": "Nový rekord čaká 📈",
        "body": "Tvoja najdlhšia séria je dlhá presne ako tá dnešná. Jedna lekcia a je dlhšia."
      },
      "R4": {
        "title": "Deň {next}? Ten tu ešte nebol 📈",
        "body": "Neprebádané územie. Dnešná lekcia z neho urobí nový rekord."
      },
      "D1": {
        "title": "{handle} čaká na tvoj ťah ⚔️",
        "body": "Rozohraný súboj a nedotknutá séria. Dnes máš čo dobiehať."
      },
      "D2": {
        "title": "Súboj s {handle} stále čaká ⚔️",
        "body": "Súper nečaká večne a séria tiež nie. Začni, čím chceš."
      },
      "L1": {
        "title": "Na postup chýba {gap} XP 📊",
        "body": "Lekcia bez chyby dáva 90 XP. Zvyšok je trojčlenka."
      },
      "L2": {
        "title": "{rank}. miesto. Hmm 📊",
        "body": "Do postupovej trojky ti chýba {gap} XP. Ostatní medzitým počítajú."
      },
      "L3": {
        "title": "Zostupová zóna ⬇️",
        "body": "Do bezpečia chýba {safe} XP. Jedna lekcia dá až 90."
      },
      "L4": {
        "title": "Liga ti uteká ⬇️",
        "body": "Si {rank}. a padáš. {safe} XP a si z toho von."
      },
      "L5": {
        "title": "{rank}. miesto a postup 🏆",
        "body": "Pozícia drží, kým ostatní spia. Oni ale nespia."
      },
      "L6": {
        "title": "Postupová trojka 🏆",
        "body": "Si v nej. Jedna dnešná lekcia a bude sa ťa horšie dobiehať."
      },
      "F1": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe 🔥",
        "body": "Ochranu série máš. Ale poistka nie je liečba, len poistka."
      },
      "F2": {
        "title": "Ochrana na sklade 🛡️",
        "body": "Neznamená to, že ju dnes musíš použiť. Sedem príkladov a zostane nedotknutá."
      },
      "F3": {
        "title": "Spoliehaš sa na ochranu? 🛡️",
        "body": "Tá stojí 60 pastiliek. Lekcia je zadarmo a ešte ti nejaké pridá."
      },
      "N1": {
        "title": "Dnešná dávka čaká 💊",
        "body": "Nula dní po sebe. Najlepšie číslo na začiatok, horšie na koniec."
      },
      "N2": {
        "title": "Čistý list 📋",
        "body": "Dnes sa píše prvý deň novej série. Pero máš ty."
      },
      "N3": {
        "title": "Deň 1 začína dnes 💊",
        "body": "Alebo zajtra. Alebo pozajtra. Alebo proste teraz, o päť minút je hotovo."
      },
      "N4": {
        "title": "Mililitre sa samy nespočítajú 💉",
        "body": "Séria je na nule. Jedna lekcia a je na jednotke."
      },
      "N5": {
        "title": "Nová séria, nová šanca 💊",
        "body": "Sedem príkladov a máš prvý deň. Ten najťažší je vždy ten prvý."
      },
      "A1": {
        "title": "Ranná dávka 💊",
        "body": "Nalačno, pred raňajkami, sedem príkladov. Deň {next} série čaká."
      },
      "A2": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe ☕",
        "body": "Káva a jedna lekcia. Potom si celý deň môžeš robiť, čo chceš."
      },
      "A3": {
        "title": "Ranná vizita 🩺",
        "body": "Séria: {days, plural, one {# deň} few {# dni} other {# dní}}, stav stabilizovaný. Odporúčanie: jedna lekcia ešte dopoludnia."
      },
      "A4": {
        "title": "Dobré ráno, {days, plural, one {# deň} few {# dni} other {# dní}} 🔥",
        "body": "Ráno vypočítané, večer voľno. Jednoduchá trojčlenka."
      },
      "P1": {
        "title": "Obedňajšia pauza? 🥪",
        "body": "Sedem príkladov sa zmestí medzi polievku a hlavné jedlo. Séria {days} dní sa ti poďakuje."
      },
      "P2": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe 🔥",
        "body": "Popoludňajší útlm sa lieči. Napríklad trojčlenkou."
      },
      "P3": {
        "title": "Popoludňajšia ordinácia 🩺",
        "body": "Pacient: tvoja séria. Diagnóza: akútny nedostatok príkladov. Terapia: jedna lekcia."
      },
      "P4": {
        "title": "Polovica dňa je preč ⏱️",
        "body": "Séria {days} dní zatiaľ nič nedostala. Napravíš to za päť minút."
      },
      "V1": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe 🔥",
        "body": "Seriál počká. Séria nie."
      },
      "V2": {
        "title": "Večerná dávka 💊",
        "body": "Jedna lekcia pred spaním. Vedľajšie účinky: dobrý pocit a dlhšia séria."
      },
      "V3": {
        "title": "Dnes zatiaľ nula príkladov 🌙",
        "body": "Séria {days} dní to vidí. A trochu sa bojí."
      },
      "V4": {
        "title": "Služba končí, séria nie 🌙",
        "body": "Päť minút na gauči a deň {next} je zapísaný."
      },
      "W1": {
        "title": "Víkend nie je výhovorka 🔥",
        "body": "Séria {days} dní nepozná voľno. Päť minút a máš ho celé."
      },
      "W2": {
        "title": "Víkendová služba 🩺",
        "body": "Žiadna vizita, žiadny seminár. Len sedem príkladov a deň {next} série."
      },
      "W3": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe ☀️",
        "body": "Brunch, výlet, čokoľvek. Ale najprv lekcia, nech máš čisté svedomie."
      },
      "W4": {
        "title": "Víkend na gauči 🛋️",
        "body": "Ideálna poloha na sedem príkladov. Séria {days} dní súhlasí."
      },
      "X1": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe 🔥",
        "body": "Dávkovanie: jedna lekcia denne. Neprekračovať? Pokojne prekroč."
      },
      "X2": {
        "title": "Recept na dnešok 📝",
        "body": "Rp. Lekcia č. I. S. raz denne, najlepšie hneď."
      },
      "X3": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe 🔥",
        "body": "Séria je ako kvetina. Tiež nemá rada, keď na ňu zabudneš."
      },
      "X4": {
        "title": "Tvoja séria je tu stále 👀",
        "body": "{days, plural, one {# deň} few {# dni} other {# dní}}. A nemieni sa nechať zabudnúť."
      },
      "X5": {
        "title": "Mililitre sa samy nespočítajú 💉",
        "body": "Skúšali sme to. Fakt nie. Séria {days} dní čaká na teba."
      },
      "X6": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}} po sebe 🔥",
        "body": "Sedem príkladov, päť minút, nula výhovoriek."
      },
      "X7": {
        "title": "Indikácia: dnešok 📋",
        "body": "Kontraindikácie: žiadne. Odporúčaná dávka: jedna lekcia."
      },
      "X8": {
        "title": "Platí to medzi vami? 💍",
        "body": "Ty a séria {days} dní. Odpoveď stačí vo forme lekcie."
      },
      "X9": {
        "title": "Gtt/min sa samy nespočítajú 💧",
        "body": "Kvapky za minútu, mg na kilo, ml za hodinu. Dnes stačí sedem z nich."
      },
      "X11": {
        "title": "Malá pripomienka 💊",
        "body": "Séria {days} dní sa neudrží sama. Teda udrží, ale len do polnoci."
      },
      "X12": {
        "title": "Jedna tableta denne 💊",
        "body": "Teda lekcia. Prehĺta sa ľahšie, než vyzerá. Deň {next} čaká."
      },
      "C1": {
        "title": "Ochrana série v ohrození 🛡️",
        "body": "Do polnoci jedna lekcia, inak ju séria dnes spotrebuje."
      },
      "C2": {
        "title": "Séria {days} dní zatiaľ prežije ⏳",
        "body": "Vďaka ochrane. Tá ale stojí 60 pastiliek a dnešná lekcia nič. Do polnoci."
      },
      "C3": {
        "title": "{days} dní na jednom vlásku ⏳",
        "body": "Toľko práce a rozhodne o nej dnešný večer. Do polnoci stačí jedna lekcia."
      },
      "C4": {
        "title": "Posledná výzva pre {days} dní 📢",
        "body": "Polnoc sa blíži, lekcia trvá päť minút. Spočítaj si to."
      },
      "C5": {
        "title": "Séria {days} dní na infúzii 💧",
        "body": "Životné funkcie slabnú. Jedna lekcia do polnoci ju postaví na nohy."
      },
      "C6": {
        "title": "Séria dlhá {days, plural, one {# deň} few {# dni} other {# dní}} visí na vlásku ⏳",
        "body": "Do polnoci stačí jedna lekcia. Zvládneš to."
      },
      "C7": {
        "title": "Tik tak ⏳",
        "body": "Séria {days} dní končí o polnoci. Ak teda dnes nespočítaš lekciu."
      },
      "C8": {
        "title": "Toto je tá správa, ktorú nechceš 😬",
        "body": "Séria {days} dní dnes padne. Ak teda do polnoci nespočítaš jednu lekciu."
      },
      "C9": {
        "title": "{days, plural, one {# deň} few {# dni} other {# dní}}, alebo nula? ⏳",
        "body": "Rozhoduje sa dnes do polnoci. Lekcia trvá päť minút."
      },
      "C10": {
        "title": "Ešte nespíš? 🌙",
        "body": "Výborne. Séria {days} dní tiež nie, čaká na jednu lekciu do polnoci."
      },
      "DC1": {
        "title": "⚔️ Výzva na súboj",
        "body": "{handle} ťa vyzýva. Prijmi do 48 hodín, inak výzva prepadne."
      },
      "DC2": {
        "title": "{handle} ťa vyzýva ⚔️",
        "body": "Sedem rovnakých príkladov, kto viac, ten vyhráva. Na prijatie máš 48 hodín."
      },
      "DC3": {
        "title": "Rukavica hodená 🧤",
        "body": "{handle} chce súboj. Zdvihneš ju? Výzva platí 48 hodín."
      },
      "DC4": {
        "title": "Niekto si na teba verí ⚔️",
        "body": "Konkrétne {handle}. Výzva platí 48 hodín."
      },
      "PO1": {
        "title": "Výzva čaká 👀",
        "body": "{handle} má odohrané a čaká, či súboj prijmeš."
      },
      "PO2": {
        "title": "{handle} už má odohrané 👀",
        "body": "Teraz je to na tebe. Prijmeš, alebo necháš výzvu prepadnúť?"
      },
      "PO3": {
        "title": "Skóre je zapečatené 🔒",
        "body": "{handle} má odohrané. Výsledok uvidíš, keď súboj prijmeš a dohráš."
      },
      "PT1": {
        "title": "Si na ťahu 👀",
        "body": "{handle} má odohrané. Skóre uvidíš, keď dohráš."
      },
      "PT2": {
        "title": "Tvoj ťah ⚔️",
        "body": "{handle} má hotovo. Ty ešte nie. Len konštatujeme."
      },
      "PT3": {
        "title": "Obálka s výsledkom čaká ✉️",
        "body": "Otvorí sa, keď dohráš súboj s {handle}."
      },
      "DA1": {
        "title": "Súboj prijatý ⚔️",
        "body": "{handle} ide do toho. Obaja máte 48 hodín na dohranie."
      },
      "DA2": {
        "title": "{handle} ide do toho ⚔️",
        "body": "Výzva prijatá. Teraz už niet cesty späť. 48 hodín."
      },
      "DA3": {
        "title": "Je to oficiálne ⚔️",
        "body": "Súboj s {handle} beží. Sedem príkladov, 48 hodín, žiadne výhovorky."
      },
      "DD1": {
        "title": "Výzva odmietnutá",
        "body": "{handle} tentoraz nehrá. Nič sa neráta, skús to inokedy."
      },
      "DD2": {
        "title": "Tentoraz nie 🤷",
        "body": "{handle} súboj neprijíma. Nič sa nedeje, ani neráta."
      },
      "DD3": {
        "title": "Súboj sa nekoná",
        "body": "{handle} tentoraz pasuje. Vyzvať sa dá aj niekoho iného."
      },
      "DE1": {
        "title": "Súboj končí o 6 hodín ⏳",
        "body": "Dohraj súboj s {handle}, inak prehráš kontumačne."
      },
      "DE2": {
        "title": "6 hodín do kontumácie ⏳",
        "body": "Súboj s {handle} čaká na tvojich sedem príkladov."
      },
      "DE3": {
        "title": "Kontumácia na obzore 🏳️",
        "body": "O 6 hodín prepadá súboj s {handle}. Prehrať bez boja je škoda."
      },
      "FW1": {
        "title": "Víťazstvo! 🏆",
        "body": "Súboj s {handle} skončil {mine}:{theirs}."
      },
      "FW2": {
        "title": "{mine}:{theirs} pre teba 🏆",
        "body": "Súboj s {handle} je tvoj. +15 pastiliek."
      },
      "FW3": {
        "title": "Výhra 🏆",
        "body": "Súboj s {handle} skončil {mine}:{theirs}. Pekne vypočítané."
      },
      "FW4": {
        "title": "Víťazstvo sa ráta 🏆",
        "body": "{mine}:{theirs} v súboji s {handle}. Odveta asi na seba nenechá dlho čakať."
      },
      "FL1": {
        "title": "Tentoraz prehra",
        "body": "Súboj s {handle} skončil {mine}:{theirs}. Odveta?"
      },
      "FL2": {
        "title": "{mine}:{theirs}. Odveta? ⚔️",
        "body": "Súboj s {handle} tentoraz nevyšiel. Nabudúce sa ráta znova."
      },
      "FL3": {
        "title": "Toto kolo pre {handle}",
        "body": "{mine}:{theirs}. Kolá sa ale dajú opakovať. Stačí vyzvať späť."
      },
      "FD1": {
        "title": "Remíza 🤝",
        "body": "Súboj s {handle} skončil {mine}:{theirs}."
      },
      "FD2": {
        "title": "{mine}:{theirs}, remíza 🤝",
        "body": "S {handle} ste si kvit. +5 pastiliek a dôvod na odvetu."
      },
      "FP1": {
        "title": "7:7, dokonalá remíza 🤝",
        "body": "S {handle} ani jedna chyba. +10 pastiliek pre každého."
      },
      "FP2": {
        "title": "Bez chyby na oboch stranách ✨",
        "body": "Súboj s {handle} skončil 7:7. Takto vyzerá remíza, za ktorú sa nehanbí nikto."
      },
      "KW1": {
        "title": "Výhra kontumačne 🏆",
        "body": "Súboj s {handle} nebol včas dohraný. Výhra je tvoja, +15 pastiliek."
      },
      "KW2": {
        "title": "Výhra bez boja 🏳️",
        "body": "Súboj s {handle} prepadol a výhra pripadá tebe. +15 pastiliek."
      },
      "KL1": {
        "title": "Súboj prepadol",
        "body": "Lehota súboja s {handle} vypršala. Ráta sa ako prehra."
      },
      "KL2": {
        "title": "48 hodín ubehlo ⌛",
        "body": "Súboj s {handle} prepadol a ráta sa ako prehra. Nabudúce stačí sedem príkladov včas."
      },
      "FR1": {
        "title": "Nová žiadosť o priateľstvo 👋",
        "body": "{handle} si ťa chce pridať medzi kamarátov."
      },
      "FR2": {
        "title": "{handle} klope na dvere 👋",
        "body": "Chce ťa medzi kamarátov. Potom sa môžete vyzývať na súboje."
      },
      "FR3": {
        "title": "Máš fanúšika 👋",
        "body": "{handle} si ťa chce pridať medzi kamarátov."
      },
      "FA1": {
        "title": "Nové priateľstvo 🤝",
        "body": "{handle} je teraz medzi kamarátmi. Čo tak súboj?"
      },
      "FA2": {
        "title": "{handle} je v partii 🤝",
        "body": "Žiadosť prijatá. Kto vyzve prvý?"
      },
      "FA3": {
        "title": "Priateľstvo potvrdené 🤝",
        "body": "S {handle} teraz navzájom vidíte série aj ligu. A môžete sa vyzvať."
      },
      "G1": {
        "title": "Darček! 🎁",
        "body": "{handle} ti posiela ochranu série. Pripíše sa, keď otvoríš aplikáciu."
      },
      "G2": {
        "title": "{handle} ti kryje chrbát 🛡️",
        "body": "Posiela ti ochranu série. Pripíše sa, keď otvoríš aplikáciu."
      },
      "G3": {
        "title": "Balíček z lekárne 🎁",
        "body": "Od {handle}: jedna ochrana série. Vyzdvihneš si ju otvorením aplikácie."
      },
      "LD1": {
        "title": "Posledný deň ligy 🔥",
        "body": "Si {rank}. a postupuješ. Udrž to!"
      },
      "LD2": {
        "title": "Postup na dosah 🏆",
        "body": "Si {rank}. a lige zostáva jeden deň. Nezaspi na vavrínoch."
      },
      "LD3": {
        "title": "Posledný deň ligy 🔥",
        "body": "Si {rank}. a na postup chýba {gap} XP."
      },
      "LD4": {
        "title": "{gap} XP do postupu 📊",
        "body": "Dnes je posledný deň ligy. Lekcia bez chyby dá 90 XP."
      },
      "LD5": {
        "title": "Posledný deň ligy 🔥",
        "body": "Si {rank}. a padáš do nižšej ligy. Do bezpečia chýba {safe} XP."
      },
      "LD6": {
        "title": "Posledná šanca na záchranu ⬇️",
        "body": "Si {rank}. a do bezpečia chýba {safe} XP. Liga dnes končí."
      },
      "LD7": {
        "title": "Posledný deň ligy 🔥",
        "body": "Si {rank}. z {size}. Dnes ešte môžeš pridať XP."
      },
      "LD8": {
        "title": "Liga dnes končí 🔥",
        "body": "{rank}. miesto z {size}. Každá lekcia ešte posúva."
      },
      "LR1": {
        "title": "Postup! 🏆",
        "body": "S {rank}. miestom postupuješ do {tier}. ligy."
      },
      "LR2": {
        "title": "Vitaj v {tier}. lige 🏆",
        "body": "{rank}. miesto minulý týždeň znamená postup. Konkurencia je tu tvrdšia."
      },
      "LR3": {
        "title": "Týždeň skončil",
        "body": "S {rank}. miestom zostupuješ do {tier}. ligy. Tento týždeň to môžeš otočiť."
      },
      "LR4": {
        "title": "Nový týždeň, nová liga",
        "body": "Minulý týždeň {rank}. miesto a zostup do {tier}. ligy. Odtiaľto sa dobre postupuje."
      },
      "LR5": {
        "title": "Nový týždeň ligy",
        "body": "Minulý týždeň {rank}. miesto z {size}. Nový týždeň práve začína."
      },
      "LR6": {
        "title": "Liga od nuly 🔄",
        "body": "Minulý týždeň {rank}. z {size}. Teraz majú všetci nula XP, vrátane tých hore."
      }
    },
    "actionLesson": "Spustiť lekciu"
  }
} as const;
