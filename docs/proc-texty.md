# Věty „proč se to tak počítá“ — ke kontrole

Jedna věta ke každé šabloně. Ukáže se nahoře v listu „Vyřešený vzor“
(docs/plan.md, B4). **Zatím nejsou v aplikaci** — vzor se bez nich
obejde a zapojí se, až je autor schválí.

Pravidla, podle kterých jsou psané:

- vysvětlují princip výpočtu, ne fakta o konkrétním léku — žádné síly,
  rozmezí ani čísla z SPC (ta jsou v zadání a mají zdroj)
- obecné převody (1 % = 10 mg/ml, 1 mg = 1000 µg) smějí zaznít, jsou to
  definice
- I3 (pravidlo 100) říká, že jde o orientační odhad — CLAUDE.md to u postupů
  odborných společností vyžaduje
- bez rodu („spočítáš“, ne „spočítal jsi“)

Co opravit: napiš číslo šablony a novou větu, nebo „škrtnout“ — karta pak
u té šablony zůstane bez věty.

## A — základní dávkování

| | CZ | SK |
|---|---|---|
| A1 | Tablet je tolik, kolikrát se síla jedné tablety vejde do ordinované dávky — dávka se dělí silou tablety. | Tabliet je toľko, koľkokrát sa sila jednej tablety zmestí do ordinovanej dávky — dávka sa delí silou tablety. |
| A2 | Síla roztoku říká, kolik léčiva je v uvedeném objemu; dávka dělená silou dá, kolikrát ten objem odměřit. | Sila roztoku hovorí, koľko liečiva je v uvedenom objeme; dávka delená silou dá, koľkokrát ten objem odmerať. |
| A3 | Léčivo je rozpuštěné v celé ampuli, takže jakou část obsahu podáváte, takovou část objemu natáhnete. | Liečivo je rozpustené v celej ampulke, takže akú časť obsahu podávate, takú časť objemu natiahnete. |
| A4 | Ampule musí dávku pokrýt celou, a proto se zaokrouhluje vždy nahoru — i kvůli malému zbytku. | Ampulky musia dávku pokryť celú, a preto sa zaokrúhľuje vždy nahor — aj kvôli malému zvyšku. |
| A5 | Dělit jde jen čísla ve stejných jednotkách, a tak se mikrogramy nejdřív převedou na miligramy (1 mg = 1000 µg). | Deliť sa dajú len čísla v rovnakých jednotkách, a tak sa mikrogramy najprv prevedú na miligramy (1 mg = 1000 µg). |
| A6 | Odebraný objem odpovídá podané části obsahu; v ampuli zbude celý objem minus to, co jste natáhli. | Odobraný objem zodpovedá podanej časti obsahu; v ampulke zostane celý objem mínus to, čo ste natiahli. |
| A7 | Nejdřív se spočítá spotřeba tablet na celou kúru; balení se zaokrouhlují nahoru, protože předepsat jde jen celé. | Najprv sa vypočíta spotreba tabliet na celú kúru; balenia sa zaokrúhľujú nahor, pretože predpísať sa dá len celé. |
| A8 | Množství léčiva je koncentrace krát objem: kolik je v jednom mililitru, tolikrát, kolik mililitrů pacient dostal. | Množstvo liečiva je koncentrácia krát objem: koľko je v jednom mililitri, toľkokrát, koľko mililitrov pacient dostal. |

## B — podle hmotnosti

| | CZ | SK |
|---|---|---|
| B1 | Dávka na kilogram se násobí hmotností pacienta — větší tělo dostane úměrně víc léčiva. | Dávka na kilogram sa násobí hmotnosťou pacienta — väčšie telo dostane úmerne viac liečiva. |
| B2 | Denní dávka podle hmotnosti se rozdělí na jednotlivá podání a teprve jedna dávka se převede na mililitry. | Denná dávka podľa hmotnosti sa rozdelí na jednotlivé podania a až jedna dávka sa prevedie na mililitre. |
| B3 | Denní strop podle hmotnosti je rozpočet na celý den; co už pacient dostal, se od něj odečte. | Denný strop podľa hmotnosti je rozpočet na celý deň; čo už pacient dostal, sa od neho odpočíta. |
| B4 | Dávka podle hmotnosti se spočítá v miligramech a převede na objem podle toho, kolik léčiva je ve stříkačce. | Dávka podľa hmotnosti sa vypočíta v miligramoch a prevedie na objem podľa toho, koľko liečiva je v striekačke. |
| B5 | Dávka podle hmotnosti platí, jen dokud nepřekročí strop jedné dávky — z obou čísel se podává to nižší. | Dávka podľa hmotnosti platí, len kým neprekročí strop jednej dávky — z oboch čísel sa podáva to nižšie. |
| B6 | Obě dávky vycházejí ze stejné hmotnosti, takže rozdíl je rozdíl dávek na kilogram krát hmotnost. | Obe dávky vychádzajú z rovnakej hmotnosti, takže rozdiel je rozdiel dávok na kilogram krát hmotnosť. |
| B7 | Kontrola předpisu jde opačně: celodenní množství se vydělí hmotností a porovná s rozmezím na kilogram. | Kontrola predpisu ide opačne: celodenné množstvo sa vydelí hmotnosťou a porovná s rozmedzím na kilogram. |
| B8 | Nejdřív se zjistí objem na jeden den; lahvička vystačí na tolik celých dní, kolikrát se do ní vejde. | Najprv sa zistí objem na jeden deň; fľaštička vystačí na toľko celých dní, koľkokrát sa do nej zmestí. |

## C — povrch těla

| | CZ | SK |
|---|---|---|
| C1 | Povrch těla roste s výškou i hmotností, ale pomaleji než každá z nich — proto odmocnina z jejich součinu. | Povrch tela rastie s výškou aj hmotnosťou, ale pomalšie než každá z nich — preto odmocnina z ich súčinu. |
| C2 | Dávka na m² se násobí povrchem těla, stejně jako se dávka na kilogram násobí hmotností. | Dávka na m² sa násobí povrchom tela, rovnako ako sa dávka na kilogram násobí hmotnosťou. |
| C3 | Tři kroky za sebou: povrch těla, z něj dávka v miligramech a nakonec objem podle koncentrace. | Tri kroky za sebou: povrch tela, z neho dávka v miligramoch a nakoniec objem podľa koncentrácie. |
| C4 | Dávka roste přímo úměrně povrchu těla, takže rozdíl dávek v procentech je stejný jako rozdíl povrchů. | Dávka rastie priamo úmerne povrchu tela, takže rozdiel dávok v percentách je rovnaký ako rozdiel povrchov. |
| C5 | Dávka podle povrchu se podá, jen pokud nepřesáhne strop — jinak se podá strop. | Dávka podľa povrchu sa podá, len ak neprekročí strop — inak sa podá strop. |

## D — ředění

| | CZ | SK |
|---|---|---|
| D1 | Ředěním se množství léčiva nemění, jen se rozloží do většího objemu: c₁ · V₁ = c₂ · V₂. | Riedením sa množstvo liečiva nemení, len sa rozloží do väčšieho objemu: c₁ · V₁ = c₂ · V₂. |
| D2 | Procento u roztoku znamená gramy ve 100 ml, tedy 1 % = 10 mg/ml; pak už jen koncentrace krát objem. | Percento pri roztoku znamená gramy v 100 ml, teda 1 % = 10 mg/ml; potom už len koncentrácia krát objem. |
| D3 | Ředění 1 : N znamená 1 g v N ml; z toho vyjde koncentrace v mg/ml a dávka se převede na objem. | Riedenie 1 : N znamená 1 g v N ml; z toho vyjde koncentrácia v mg/ml a dávka sa prevedie na objem. |
| D4 | Léčivo z přidaného objemu se rozloží do celé infuze: jeho množství se vydělí celkovým objemem. | Liečivo z pridaného objemu sa rozloží do celej infúzie: jeho množstvo sa vydelí celkovým objemom. |
| D5 | Když obal uvádí mmol v jednom mililitru, stačí ordinované mmol tímto číslem vydělit. | Keď obal uvádza mmol v jednom mililitri, stačí ordinované mmol týmto číslom vydeliť. |
| D6 | Nejdřív se spočítá potřebný objem koncentrátu; rozpouštědlo doplní zbytek do cílového objemu. | Najprv sa vypočíta potrebný objem koncentrátu; rozpúšťadlo doplní zvyšok do cieľového objemu. |
| D7 | Výsledná koncentrace je všechno léčivo z obou roztoků dělené jejich společným objemem — vážený průměr, ne prostý. | Výsledná koncentrácia je všetko liečivo z oboch roztokov delené ich spoločným objemom — vážený priemer, nie prostý. |
| D8 | Poměr i procento popisují gramy v mililitrech: 1 : N je 1 g v N ml, procento je počet gramů ve 100 ml. | Pomer aj percento opisujú gramy v mililitroch: 1 : N je 1 g v N ml, percento je počet gramov v 100 ml. |

## E — rekonstituce

| | CZ | SK |
|---|---|---|
| E1 | Rozpuštěním vznikne roztok o koncentraci obsah lahvičky dělený objemem rozpouštědla; dávka se pak převede na mililitry. | Rozpustením vznikne roztok s koncentráciou obsah fľaštičky delený objemom rozpúšťadla; dávka sa potom prevedie na mililitre. |
| E2 | Koncentrace nesmí přesáhnout limit, takže objem musí být aspoň tak velký, aby dávka dělená objemem limit nepřekročila. | Koncentrácia nesmie prekročiť limit, takže objem musí byť aspoň taký veľký, aby dávka delená objemom limit neprekročila. |
| E3 | Objem se volí tak, aby v něm dávka měla zvolenou koncentraci: objem = množství ÷ koncentrace. | Objem sa volí tak, aby v ňom dávka mala zvolenú koncentráciu: objem = množstvo ÷ koncentrácia. |
| E4 | Rozpuštěný prášek sám zabírá místo, takže objem je rozpouštědlo plus prášek — a koncentrace je nižší, než by vyšlo ze samotného rozpouštědla. | Rozpustený prášok sám zaberá miesto, takže objem je rozpúšťadlo plus prášok — a koncentrácia je nižšia, než by vyšlo zo samotného rozpúšťadla. |
| E5 | Lahvičky musí pokrýt celou dávku, a proto se zaokrouhluje nahoru. | Fľaštičky musia pokryť celú dávku, a preto sa zaokrúhľuje nahor. |

## F — rychlost infuze

| | CZ | SK |
|---|---|---|
| F1 | Rychlost je objem za čas; pumpa jede v ml/h, a tak se čas vyjádří v hodinách. | Rýchlosť je objem za čas; pumpa beží v ml/h, a tak sa čas vyjadrí v hodinách. |
| F2 | Kapek je objem krát kapkový faktor, tedy kolik kapek dá jeden mililitr; dělí se časem v minutách. | Kvapiek je objem krát kvapkový faktor, teda koľko kvapiek dá jeden mililiter; delí sa časom v minútach. |
| F3 | U setu s faktorem 60 kapek/ml se kapky za minutu číselně rovnají ml/h: 60 kapek je 1 ml a hodina má 60 minut. | Pri sete s faktorom 60 kvapiek/ml sa kvapky za minútu číselne rovnajú ml/h: 60 kvapiek je 1 ml a hodina má 60 minút. |
| F4 | Doba je objem dělený rychlostí; vyjde v hodinách, a tak se násobí šedesáti na minuty. | Čas je objem delený rýchlosťou; vyjde v hodinách, a tak sa násobí šesťdesiatimi na minúty. |
| F5 | Kapky za minutu se přes kapkový faktor převedou na mililitry a minuty krát 60 na hodinu. | Kvapky za minútu sa cez kvapkový faktor prevedú na mililitre a minúty krát 60 na hodinu. |
| F6 | Nejdřív se zjistí, kolik už doteklo; zbytek ve vaku se vydělí rychlostí a převede na minuty. | Najprv sa zistí, koľko už pretieklo; zvyšok vo vaku sa vydelí rýchlosťou a prevedie na minúty. |

## G — vazoaktivní léky

| | CZ | SK |
|---|---|---|
| G1 | Rychlost je hodinová dávka dělená koncentrací; µg/min se krát 60 převedou na hodinu a děleno 1000 na mg, aby seděly s mg/ml. | Rýchlosť je hodinová dávka delená koncentráciou; µg/min sa krát 60 prevedú na hodinu a delené 1000 na mg, aby sedeli s mg/ml. |
| G2 | Jako u dávky za minutu, jen se dávka na kilogram nejdřív vynásobí hmotností. | Ako pri dávke za minútu, len sa dávka na kilogram najprv vynásobí hmotnosťou. |
| G3 | Opačný směr: z rychlosti a koncentrace vyjde, kolik léčiva pacient dostává za hodinu, a to se rozpočítá na kilogram a minutu. | Opačný smer: z rýchlosti a koncentrácie vyjde, koľko liečiva pacient dostáva za hodinu, a to sa rozpočíta na kilogram a minútu. |
| G4 | Léčiva je potřeba cílová koncentrace krát objem stříkačky; každá ampule přidá svůj obsah. | Liečiva treba cieľová koncentrácia krát objem striekačky; každá ampulka pridá svoj obsah. |
| G5 | Rychlost roste přímo úměrně dávce, takže obě rychlosti se spočítají stejným vzorcem a odečtou. | Rýchlosť rastie priamo úmerne dávke, takže obe rýchlosti sa vypočítajú rovnakým vzorcom a odpočítajú. |
| G6 | Stříkačka má mít daný objem; co v ní nezabírají ampule, doplní fyziologický roztok. | Striekačka má mať daný objem; čo v nej nezaberajú ampulky, doplní fyziologický roztok. |
| G7 | Dávka na kilogram a minutu krát hmotnost dá dávku za minutu; opačným směrem se hmotností dělí. | Dávka na kilogram a minútu krát hmotnosť dá dávku za minútu; opačným smerom sa hmotnosťou delí. |

## H — převody jednotek

| | CZ | SK |
|---|---|---|
| H1 | Mezi g, mg, µg a ng je vždy tisícinásobek; kolik kroků, tolikrát krát nebo děleno tisícem. | Medzi g, mg, µg a ng je vždy tisícnásobok; koľko krokov, toľkokrát krát alebo delené tisícom. |
| H2 | Molární hmotnost v g/mol je číselně totéž co mg/mmol, takže mezi mg a mmol se převádí molární hmotností; u dvojmocného iontu je 1 mmol = 2 mEq. | Molárna hmotnosť v g/mol je číselne to isté čo mg/mmol, takže medzi mg a mmol sa prevádza molárnou hmotnosťou; pri dvojmocnom ióne je 1 mmol = 2 mEq. |
| H3 | Aktivita je udaná v IU na mililitr, takže ordinované IU se vydělí aktivitou jednoho mililitru. | Aktivita je uvedená v IU na mililiter, takže ordinované IU sa vydelia aktivitou jedného mililitra. |
| H4 | Obal uvádí obojí, a z toho vyjde, kolik IU odpovídá jednomu miligramu — tím poměrem se převádí. | Obal uvádza oboje, a z toho vyjde, koľko IU zodpovedá jednému miligramu — tým pomerom sa prevádza. |
| H5 | Procento u roztoku znamená gramy ve 100 ml: 1 % = 1 g / 100 ml = 10 g/l = 10 mg/ml. | Percento pri roztoku znamená gramy v 100 ml: 1 % = 1 g / 100 ml = 10 g/l = 10 mg/ml. |
| H6 | Hmotnostní koncentrace dělená molární hmotností dá látkovou; sůl se rozpadne na ionty, a tak z jednoho molu soli vznikne tolik molů iontu, kolikrát je ve vzorci. | Hmotnostná koncentrácia delená molárnou hmotnosťou dá látkovú; soľ sa rozpadne na ióny, a tak z jedného mólu soli vznikne toľko mólov iónu, koľkokrát je vo vzorci. |

## I — inzulin

| | CZ | SK |
|---|---|---|
| I1 | Běžná stříkačka měří mililitry, ne jednotky, a tak se IU převedou na ml podle koncentrace inzulinu. | Bežná striekačka meria mililitre, nie jednotky, a tak sa IU prevedú na ml podľa koncentrácie inzulínu. |
| I2 | Inzulin není vždy 100 IU/ml; při jiné koncentraci dá stejný objem jinou dávku, a proto se počítá z koncentrace na obalu. | Inzulín nie je vždy 100 IU/ml; pri inej koncentrácii dá rovnaký objem inú dávku, a preto sa počíta z koncentrácie na obale. |
| I3 | Pravidlo 100 odhaduje, o kolik mmol/l sníží glykémii jedna jednotka (100 ÷ celková denní dávka); je to orientační odhad pro začátek, ne ordinace. | Pravidlo 100 odhaduje, o koľko mmol/l zníži glykémiu jedna jednotka (100 ÷ celková denná dávka); je to orientačný odhad na začiatok, nie ordinácia. |
| I4 | Zásoba v IU je objem krát koncentrace; vydělená denní dávkou dá celé dny — načatý den se nepočítá. | Zásoba v IU je objem krát koncentrácia; vydelená dennou dávkou dá celé dni — načatý deň sa nepočíta. |

## J — renální dávkování

| | CZ | SK |
|---|---|---|
| J1 | Když ledviny filtrují hůř, kreatinin v krvi stoupá; vzorec ho převádí na clearance s ohledem na věk a hmotnost, u žen krát 0,85. | Keď obličky filtrujú horšie, kreatinín v krvi stúpa; vzorec ho prevádza na klírens s ohľadom na vek a hmotnosť, u žien krát 0,85. |
| J2 | Clearance určí pásmo v SPC a to, jak často se dávka opakuje; za 24 hodin je to jedna dávka krát počet podání. | Klírens určí pásmo v SPC a to, ako často sa dávka opakuje; za 24 hodín je to jedna dávka krát počet podaní. |
| J3 | Horší ledviny léčivo vylučují pomaleji, a proto SPC podle pásma clearance určí dávku na m², která se násobí povrchem těla. | Horšie obličky liečivo vylučujú pomalšie, a preto SPC podľa pásma klírensu určí dávku na m², ktorá sa násobí povrchom tela. |
| J4 | Při snížené funkci ledvin odchází léčivo z těla pomaleji, a tak se dávky dávají v delších odstupech — interval se odečte v tabulce podle eGFR. | Pri zníženej funkcii obličiek odchádza liečivo z tela pomalšie, a tak sa dávky dávajú v dlhších odstupoch — interval sa odčíta v tabuľke podľa eGFR. |
| J5 | Pásmo clearance určí sníženou dávku; její podíl vůči plné dávce se vyjádří v procentech. | Pásmo klírensu určí zníženú dávku; jej podiel voči plnej dávke sa vyjadrí v percentách. |

## K — pediatrie

| | CZ | SK |
|---|---|---|
| K1 | Denní dávka podle hmotnosti se rozdělí na jednotlivá podání a jedna dávka se převede na mililitry. | Denná dávka podľa hmotnosti sa rozdelí na jednotlivé podania a jedna dávka sa prevedie na mililitre. |
| K2 | Strop denní dávky se rozdělí na počet podání — tak vyjde největší jedna dávka, a ta se převede na mililitry. | Strop dennej dávky sa rozdelí na počet podaní — tak vyjde najväčšia jedna dávka, a tá sa prevedie na mililitre. |
| K3 | Všechno v jednom zlomku: denní dávka podle hmotnosti, rozdělená na dvě podání a převedená na mililitry. | Všetko v jednom zlomku: denná dávka podľa hmotnosti, rozdelená na dve podania a prevedená na mililitre. |
| K4 | Dávka na kilogram se násobí hmotností dítěte. | Dávka na kilogram sa násobí hmotnosťou dieťaťa. |
| K5 | Kontrola předpisu: jedna dávka krát počet podání dá denní dávku, a ta dělená hmotností se porovná s rozmezím. | Kontrola predpisu: jedna dávka krát počet podaní dá dennú dávku, a tá delená hmotnosťou sa porovná s rozmedzím. |
| K6 | Dávka v miligramech se nesmí změnit: spočítá se z původního předpisu a přepočítá na objem nového sirupu. | Dávka v miligramoch sa nesmie zmeniť: vypočíta sa z pôvodného predpisu a prepočíta na objem nového sirupu. |

## L — onkologie

| | CZ | SK |
|---|---|---|
| L1 | Calvertův vzorec počítá dávku z cílové expozice (AUC) a z toho, jak rychle tělo karboplatinu odstraní: ledvinami (GFR) a asi 25 ml/min jinými cestami. | Calvertov vzorec počíta dávku z cieľovej expozície (AUC) a z toho, ako rýchlo telo karboplatinu odstráni: obličkami (GFR) a asi 25 ml/min inými cestami. |
| L2 | Dávka podle Calverta, AUC × (GFR + 25), se převede na mililitry koncentrátu. | Dávka podľa Calverta, AUC × (GFR + 25), sa prevedie na mililitre koncentrátu. |
| L3 | Snížit o p % znamená podat (100 − p) % plné dávky; plná dávka se nejdřív spočítá z povrchu těla. | Znížiť o p % znamená podať (100 − p) % plnej dávky; plná dávka sa najprv vypočíta z povrchu tela. |
| L4 | Celoživotní limit se sčítá přes všechny cykly; zbývá tolik celých cyklů, kolik se jich vejde do zbytku — načatý cyklus se podat nesmí. | Celoživotný limit sa sčítava cez všetky cykly; zostáva toľko celých cyklov, koľko sa ich zmestí do zvyšku — načatý cyklus sa podať nesmie. |
