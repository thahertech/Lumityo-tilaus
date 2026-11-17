# Lumityö-sovelluksen tietosuojaseloste

**LUONNOS – ei julkaistavaksi ennen hakasulkeissa olevien tietojen täydentämistä, käytäntöjen varmistamista ja oikeudellista tarkastusta.**

**Suunniteltu lumityöpaketti:** ostotietoihin on tarkoitus tallentaa vahvistettu sähköposti, palveluosoite, puhelinnumero ja ostossa käytetyn laitteen tunniste. Ennen maksutoiminnon julkaisua on täydennettävä tiedot sähköpostin vahvistamisesta, pakettiostoista ja käyttökerroista, tilauspyyntöjen tallentamisesta tapahtumakirjanpitoon, maksutapahtumista, kuiteista, Paytrailista ja sähköpostin välittäjästä sekä näiden säilytysajoista, käsittelyperusteista ja mahdollisista kansainvälisistä siirroista. Maksukorttitietoja ei tule kerätä sovelluksen omaan tietokantaan.

**Suunniteltu peruuttamistoiminto:** ilmoitukseen tallennetaan asiakkaan ilmoittama nimi, sähköpostiosoite, sopimuksen tiedot ja vastaanottoaika. Ilmoituksesta on tarkoitus lähettää sähköpostivahvistus asiakkaalle ja ilmoitus asiakaspalvelulle. Ennen käyttöönottoa on varmistettava käsittelyperusteet, säilytysajat, sähköpostipalvelun tietojenkäsittely sekä mahdolliset kansainväliset siirrot.

Tässä selosteessa kerrotaan, miten Lumityö-sovelluksen käyttäjien ja asiakkaiden henkilötietoja käsitellään. Seloste koskee sovelluksen käyttöä, tilausten tekemistä ja asiakaspalveluyhteydenottoja.

## 1. Rekisterinpitäjä ja yhteystiedot

Finntuote  
Y-tunnus: 2640397-5  
Temmeksentie 4 A 3  
90400 Oulu

Tietosuoja-asioiden yhteyshenkilö: Matias Nuutinen  
Sähköposti: lumitoimeksiannot@gmail.com

Voit lähettää tietosuojaa koskevan pyynnön myös sovelluksen yhteydenottolomakkeella tai yllä olevaan postiosoitteeseen.

## 2. Mitä tietoja käsittelemme?

Käsiteltäviä tietoja voivat olla:

- nimi, puhelinnumero, osoite ja mahdollinen sähköpostiosoite;
- tilauksen palvelu, tila, ajankohta, hinta- tai hintatiedot, mahdollinen maksuttomaan ensimmäiseen tilaukseen liittyvä tieto sekä jatkuvaa tilausta koskevat tiedot;
- toimitusosoitteen sijaintikoordinaatit ja tilaajan antamat lisäohjeet;
- yhteydenottoviestin sisältö ja siinä annetut yhteystiedot;
- laitteeseen liittyvä tunniste, jonka avulla sovellus yhdistää tallennetut asiakastiedot ja tilaushistorian käytettyyn laitteeseen.

Sovellus voi käyttäjän pyynnöstä ja laitteen sijaintiluvan perusteella hakea laitteen sijainnin osoitteen määrittämiseksi. Tilauksen yhteydessä tallennettavat sijaintikoordinaatit liittyvät tilauksen kohteeseen. Käyttäjä voi syöttää osoitteen myös käsin.

Älä kirjoita tilauksen lisätietoihin tai yhteydenottoviestiin arkaluonteisia henkilötietoja, kuten terveystietoja, ellei niiden ilmoittaminen ole välttämätöntä.

## 3. Mistä tiedot saadaan?

Tiedot saadaan pääasiassa sinulta, kun annat tietoja sovelluksessa, teet tilauksen tai otat yhteyttä. Tilausta ja sen tilaa koskevia tietoja syntyy myös palvelua toteutettaessa. Osoite- ja sijaintitietoja voidaan täydentää osoitehaku- ja karttapalvelujen avulla. Laitetunniste saadaan laitteelta tai luodaan sovelluksessa.

## 4. Miksi tietoja käsitellään ja millä perusteella?

| Käyttötarkoitus | Oikeusperuste |
| --- | --- |
| Tilauksen vastaanottaminen ja toteuttaminen, palvelukohteen paikantaminen, asiakastietojen ja tilaushistorian näyttäminen sekä tilaukseen liittyvä yhteydenpito | Sopimuksen täytäntöönpano tai sopimuksen tekemistä edeltävät, pyynnöstäsi tehtävät toimenpiteet, GDPR 6 artiklan 1 kohdan b alakohta, siltä osin kuin käsittely on niiden kannalta tarpeen. |
| Kirjanpito ja muut soveltuvat lakisääteiset velvoitteet | Lakisääteisen velvoitteen noudattaminen, GDPR 6 artiklan 1 kohdan c alakohta. |
| [Täydennettävä: mahdolliset muut käyttötarkoitukset, kuten tietoturva ja oikeudellisten vaateiden käsittely, niiden oikeusperusteet sekä mahdollisen oikeutetun edun kuvaus ja tasapainotesti.] | [Täydennettävä.] |

Osa tiedoista on tarpeen tilauksen tekemiseksi ja palvelun toteuttamiseksi. Jos tarpeellisia tietoja ei anneta, tilausta ei välttämättä voida käsitellä. Sähköpostiosoitteen antaminen profiilissa on vapaaehtoista, mutta yhteydenottolomake tarvitsee sähköpostiosoitteen vastauksen lähettämistä varten.

Laitteen sijaintilupa on vapaaehtoinen. Laitteen käyttöoikeus ei yksin määritä henkilötietojen käsittelyn oikeusperustetta. Sijaintiluvan voi muuttaa laitteen asetuksissa.

## 5. Tietojen vastaanottajat ja palveluntarjoajat

Tietoja käsittelevät palvelun toteuttamiseen ja asiakaspalveluun osallistuvat henkilöt tehtäviensä edellyttämässä laajuudessa. Käytämme seuraavia palveluja:

- **Supabase:** asiakas- ja tilaustietojen tallentaminen ja käsittely.
- **Mapbox:** osoitehaut ja kartan näyttäminen. Osoitehakuihin annettuja tietoja välitetään palvelulle.
- **OpenCage:** osoitehaut ja osoitteiden paikantaminen. Hakuihin annettuja tietoja välitetään palvelulle.
- **EmailJS:** yhteydenottoviestien välittäminen. Viestin sisältö ja sähköpostiosoite välitetään palvelulle sekä käytössä olevalle sähköpostipalvelulle.
- **Ilmatieteen laitos:** Oulun sääennusteen hakeminen. Sovellus hakee ennusteen suoraan Ilmatieteen laitoksen avoimen datan palvelusta, jolloin palvelu saa laitteen verkkoyhteyden IP-osoitteen. Sääennusteen hakemiseen ei käytetä laitteen sijaintia, asiakkaan osoitetta tai muita asiakastietoja.

[Täydennettävä: Ilmatieteen laitoksen palvelun mahdolliset lokitus- ja säilytyskäytännöt sekä käsittelyn oikeusperuste. Täydennettävä myös käytössä oleva sähköpostipalvelu, mahdolliset työn suorittajat, laskutus- ja muut palveluntarjoajat sekä niiden roolit ja käsiteltävät tiedot. Varmistettava palveluntarjoajien kanssa sovitut henkilötietojen käsittelyehdot ja käsittelysopimukset.]

## 6. Tietojen siirrot EU:n ja ETA:n ulkopuolelle

[Täydennettävä ennen julkaisua: kunkin palveluntarjoajan ja mahdollisten alikäsittelijöiden käsittelymaat, mahdolliset EU:n tai ETA:n ulkopuoliset siirrot sekä niihin sovellettavat GDPR:n V luvun mukaiset siirtoperusteet ja suojatoimet. Kerrottava myös, mistä suojatoimia koskevat tiedot ovat saatavissa. Palvelimen sijainti yksin ei osoita, ettei tietoja käsitellä tai niihin päästä käsiksi muualta.]

## 7. Kuinka kauan tietoja säilytetään?

Henkilötietoja säilytetään vain niin kauan kuin se on tarpeen niiden käyttötarkoituksen tai soveltuvan lakisääteisen velvoitteen vuoksi. Säilytysaika määräytyy tietoryhmän ja käyttötarkoituksen mukaan.

[Täydennettävä: asiakas- ja tilaustietojen tosiasialliset säilytysajat, 24 kuukauden mahdollisen toimettomuusajan tarkka alkamis- ja määräytymisperuste sekä se, miten aktiiviset tai jatkuvat tilaukset huomioidaan.]

[Täydennettävä: kirjanpitoaineiston, mahdollisten riita- tai perintäasioiden, yhteydenottoviestien, lokien ja varmuuskopioiden erilliset säilytysajat ja perusteet sekä poistamis- tai anonymisointikäytännöt.]

**Valmistelua varten:** 24 kuukauden toimettomuuteen perustuvaa poistamista on ehdotettu. Toimettomuusajan olisi tarkoitus alkaa sovelluksen viimeisestä avaamisesta, tilauksesta tai profiilin päivityksestä. Poistettavia tietoryhmiä, poikkeuksia ja toteutusta ei ole vielä vahvistettu. Tätä määräaikaa tai automaattista poistamista ei saa esittää käytössä olevana ennen kuin toimintatapa on hyväksytty, toteutettu ja varmennettu.

## 8. Tietojen suojaaminen

Tietojen suojaamiseksi on toteutettava käsittelyn riskeihin nähden asianmukaiset tekniset ja organisatoriset toimenpiteet. Tietoihin pääsy on rajattava työtehtävien perusteella.

[Täydennettävä ja varmennettava: käytössä olevat pääsynhallinnan, tiedonsiirron, varmuuskopioinnin ja muiden suojaustoimien kuvaukset. Tarkista erityisesti tuotantotietokannan käyttöoikeudet ja tietoturva ennen julkaisua.]

## 9. Laitteelle tallennettavat tiedot

Sovellus tallentaa laitteelle sovelluksen käyttöön liittyviä tietoja, kuten teema-asetuksen ja tarvittaessa sovelluksen luoman laitetunnisteen. Näiden tietojen poistaminen laitteelta ei itsessään tarkoita, että palveluntarjoajien järjestelmissä olevat tiedot poistuvat.

[Varmistettava: muut laitteelle tallennettavat tiedot, niiden käyttötarkoitukset ja säilyminen sekä mahdollinen suostumuksen tarve.]

## 10. Oikeutesi

Sinulla on soveltuvan lainsäädännön mukaisesti oikeus:

- saada tieto henkilötietojesi käsittelystä ja tarkastaa itseäsi koskevat tiedot;
- pyytää virheellisten tai puutteellisten tietojen oikaisemista;
- pyytää tietojen poistamista tai käsittelyn rajoittamista;
- vastustaa oikeutettuun etuun perustuvaa käsittelyä;
- saada antamasi tiedot siirretyksi järjestelmästä toiseen silloin, kun oikeuden edellytykset täyttyvät;
- peruuttaa suostumus silloin, kun käsittely perustuu suostumukseen. Peruuttaminen ei vaikuta sitä ennen tapahtuneen käsittelyn lainmukaisuuteen.

Oikeudet eivät ole kaikissa tilanteissa ehdottomia. Esimerkiksi lakisääteinen säilytysvelvollisuus voi estää joidenkin tietojen välittömän poistamisen.

Voit käyttää oikeuksiasi ottamalla yhteyttä kohdassa 1 ilmoitetulla tavalla. Sovelluksen **Tietosuoja**-kohdasta voit myös avata valmiiksi täytetyn poistopyynnön yhteydenottolomakkeessa. Pyyntö lähetetään vasta, kun lähetät lomakkeen; se ei poista tietoja automaattisesti. Voimme tarvittaessa pyytää lisätietoja henkilöllisyytesi varmistamiseksi.

Vastaamme pyyntöön ilman aiheetonta viivytystä ja pääsääntöisesti kuukauden kuluessa. Määräaikaa voidaan lainsäädännön sallimissa tilanteissa jatkaa; ilmoitamme jatkosta ja sen perusteesta.

## 11. Oikeus tehdä valitus

Jos katsot, että henkilötietojesi käsittelyssä rikotaan tietosuojalainsäädäntöä, sinulla on oikeus tehdä valitus valvontaviranomaiselle. Suomessa valvontaviranomainen on tietosuojavaltuutetun toimisto: [tietosuoja.fi](https://tietosuoja.fi/).

## 12. Automaattinen päätöksenteko ja profilointi

[Täydennettävä tarkistuksen jälkeen: tehdäänkö henkilötietojen perusteella GDPR:n 22 artiklassa tarkoitettuja automatisoituja päätöksiä tai profilointia. Arvioinnissa on huomioitava myös automaattinen ensimmäisen maksuttoman tilauksen kelpoisuuden tarkistus.]

## 13. Selosteen muutokset

Päivitämme selostetta tarvittaessa esimerkiksi silloin, kun käsittelykäytännöt muuttuvat. Merkittävistä muutoksista ilmoitetaan soveltuvan lainsäädännön edellyttämällä tavalla.

Selosteen päivämäärä: [täydennettävä]
