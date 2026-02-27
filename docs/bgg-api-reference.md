# BGG XML API2 — Reference

Base URL: `https://boardgamegeek.com/xmlapi2/`

Authentication: Bearer token via header `Authorization: Bearer <BGG_API_KEY>`

Official docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2

---

## `/collection` — User collection data

**URL:** `/collection?username={username}&stats=1`

### Query Parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `username` | Yes | String | BGG username |
| `subtype` | No | String | `boardgame`, `boardgameexpansion`, `boardgameaccessory`, `rpgitem`, `videogame` |
| `excludesubtype` | No | String | Exclude specific subtype |
| `id` | No | CSV integers | Filter by specific game IDs |
| `stats` | No | Boolean (1) | Include game stats (players, playtime, ratings) |
| `version` | No | Boolean (1) | Include version/edition info |
| `brief` | No | Boolean (1) | Return abbreviated results (status and name only) |
| `showprivate` | No | Boolean (1) | Show private collection info (requires auth) |
| `own` | No | 0/1 | Filter: owned items |
| `rated` | No | 0/1 | Filter: rated items |
| `played` | No | 0/1 | Filter: played items |
| `commented` | No | 0/1 | Filter: commented items |
| `trade` | No | 0/1 | Filter: for trade |
| `want` | No | 0/1 | Filter: wanted in trade |
| `wishlist` | No | 0/1 | Filter: on wishlist |
| `wishlistpriority` | No | 1-5 | Filter by wishlist priority (1=Must have, 5=Don't buy) |
| `preordered` | No | 0/1 | Filter: preordered |
| `wanttoplay` | No | 0/1 | Filter: want to play |
| `wanttobuy` | No | 0/1 | Filter: want to buy |
| `prevowned` | No | 0/1 | Filter: previously owned |
| `hasparts` | No | 0/1 | Filter: has parts list |
| `wantparts` | No | 0/1 | Filter: want parts list |
| `minrating` | No | 1-10 | Minimum personal rating |
| `rating` | No | 1-10 | Maximum personal rating |
| `minbggrating` | No | 1-10 | Minimum BGG rating |
| `bggrating` | No | 1-10 | Maximum BGG rating |
| `minplays` | No | Integer | Minimum recorded plays |
| `maxplays` | No | Integer | Maximum recorded plays |
| `collid` | No | Integer | Filter by collection ID |
| `modifiedsince` | No | YY-MM-DD | Only items modified since date |

### Response Structure

```xml
<items totalitems="79" termsofuse="..." pubdate="...">
  <item objecttype="thing" objectid="173346" subtype="boardgame" collid="142964641">
    <name sortindex="1">7 Wonders Duel</name>
    <originalname>7 Wonders Duel</originalname>
    <yearpublished>2015</yearpublished>
    <image>https://cf.geekdo-images.com/...</image>
    <thumbnail>https://cf.geekdo-images.com/...</thumbnail>
    <numplays>5</numplays>
    <comment>Great game!</comment>
    <wishlistcomment>...</wishlistcomment>

    <status own="1" prevowned="0" fortrade="0" want="0"
            wanttoplay="0" wanttobuy="0" wishlist="0"
            preordered="0" lastmodified="2024-06-01 01:28:53" />

    <!-- Only with stats=1 -->
    <stats minplayers="2" maxplayers="2"
           minplaytime="30" maxplaytime="30"
           playingtime="30" numowned="123456">
      <rating value="8.5">  <!-- User's personal rating, or "N/A" -->
        <usersrated value="50000" />
        <average value="7.95" />
        <bayesaverage value="7.80" />
        <stddev value="1.15" />
        <median value="0" />
        <ranks>
          <rank type="subtype" id="1" name="boardgame"
                friendlyname="Board Game Rank"
                value="25" bayesaverage="7.80" />
          <rank type="family" id="5497" name="strategygames"
                friendlyname="Strategy Game Rank"
                value="18" bayesaverage="7.85" />
        </ranks>
      </rating>
    </stats>
  </item>
</items>
```

### Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `@objectid` | Integer | BGG thing ID |
| `@subtype` | String | `boardgame` or `boardgameexpansion` |
| `@collid` | Integer | Collection entry ID |
| `name` | String | Game name (attr `sortindex`) |
| `originalname` | String | Original name if different from localized |
| `yearpublished` | String | Year of publication |
| `image` | URI | Full image URL |
| `thumbnail` | URI | Thumbnail image URL |
| `numplays` | Integer | Times played by user |
| `comment` | String | User comment |
| `wishlistcomment` | String | Wishlist comment |

### Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `own` | 0/1 | User owns this item |
| `prevowned` | 0/1 | Previously owned |
| `fortrade` | 0/1 | Available for trade |
| `want` | 0/1 | Wanted in trade |
| `wanttoplay` | 0/1 | Want to play |
| `wanttobuy` | 0/1 | Want to buy |
| `wishlist` | 0/1 | On wishlist |
| `wishlistpriority` | 1-5 | Wishlist priority |
| `preordered` | 0/1 | Preordered |
| `lastmodified` | DateTime | Last status change |

### Stats Fields (with `stats=1`)

| Field | Type | Description |
|-------|------|-------------|
| `minplayers` | Integer | Minimum players |
| `maxplayers` | Integer | Maximum players |
| `playingtime` | Integer | Average play time (minutes) |
| `minplaytime` | Integer | Minimum play time |
| `maxplaytime` | Integer | Maximum play time |
| `numowned` | Integer | Total BGG users who own it |
| `rating/@value` | Decimal | User's personal rating (or "N/A") |
| `average` | Decimal | Average BGG rating (0-10) |
| `bayesaverage` | Decimal | Bayesian average (GeekRating) |
| `usersrated` | Integer | Number of users who rated |
| `stddev` | Decimal | Standard deviation |
| `median` | Decimal | Median rating |
| `ranks` | Array | Ranking positions (see example above) |

### Private Info (with `showprivate=1`)

| Field | Type | Description |
|-------|------|-------------|
| `pp_currency` | String | Currency of price paid |
| `pricepaid` | Decimal | Price paid |
| `cv_currency` | String | Currency of current value |
| `currvalue` | Decimal | Current estimated value |
| `quantity` | Integer | Quantity owned |
| `acquisitiondate` | Date | When acquired |
| `acquiredfrom` | String | Where/who acquired from |
| `inventorylocation` | String | Storage location |
| `privatecomment` | String | Private notes |

---

## `/thing` — Full game details

**URL:** `/thing?id={id}&stats=1`

### Query Parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `id` | Yes | CSV integers | One or more thing IDs (e.g. `174430,13`) |
| `type` | No | String | `boardgame`, `boardgameexpansion`, `boardgameaccessory`, `videogame`, `rpgitem` |
| `stats` | No | Boolean (1) | Include statistics and ratings |
| `versions` | No | Boolean (1) | Include version/edition info |
| `videos` | No | Boolean (1) | Include linked videos |
| `marketplace` | No | Boolean (1) | Include marketplace listings |
| `comments` | No | Boolean (1) | Include user comments (paginated) |
| `ratingcomments` | No | Boolean (1) | Include comments with ratings (paginated) |
| `page` | No | Integer | Page for comments (default: 1) |
| `pagesize` | No | 10-100 | Page size for comments (default: 100) |

### Response Structure

```xml
<items termsofuse="...">
  <item type="boardgame" id="173346">
    <thumbnail>https://cf.geekdo-images.com/...</thumbnail>
    <image>https://cf.geekdo-images.com/...</image>

    <name type="primary" sortindex="1" value="7 Wonders Duel" />
    <name type="alternate" sortindex="1" value="7 Csoda Párbaj" />

    <description>In 7 Wonders Duel, each player...</description>
    <yearpublished value="2015" />
    <minplayers value="2" />
    <maxplayers value="2" />
    <playingtime value="30" />
    <minplaytime value="30" />
    <maxplaytime value="30" />
    <minage value="10" />

    <!-- Links -->
    <link type="boardgamecategory" id="1050" value="Ancient" />
    <link type="boardgamemechanic" id="2041" value="Card Play Conflict Resolution" />
    <link type="boardgamedesigner" id="9714" value="Antoine Bauza" />
    <link type="boardgameartist" id="12016" value="Miguel Coimbra" />
    <link type="boardgamepublisher" id="4384" value="Repos Production" />
    <link type="boardgamefamily" id="70" value="7 Wonders" />
    <link type="boardgameexpansion" id="202976" value="7 Wonders Duel: Pantheon" />
    <link type="boardgameexpansion" id="173346" value="7 Wonders Duel" inbound="true" />

    <!-- Polls -->
    <poll name="suggested_numplayers" title="User Suggested Number of Players" totalvotes="500">
      <results numplayers="1">
        <result value="Best" numvotes="5" />
        <result value="Recommended" numvotes="20" />
        <result value="Not Recommended" numvotes="400" />
      </results>
      <results numplayers="2">
        <result value="Best" numvotes="490" />
        <result value="Recommended" numvotes="10" />
        <result value="Not Recommended" numvotes="0" />
      </results>
    </poll>

    <poll name="suggested_playerage" title="User Suggested Player Age" totalvotes="100">
      <results>
        <result value="10" numvotes="60" />
        <result value="12" numvotes="30" />
      </results>
    </poll>

    <poll name="language_dependence" title="Language Dependence" totalvotes="50">
      <results>
        <result level="1" value="No necessary in-game text" numvotes="40" />
        <result level="2" value="Some necessary text" numvotes="10" />
      </results>
    </poll>

    <!-- Statistics (with stats=1) -->
    <statistics page="1">
      <ratings>
        <usersrated value="50000" />
        <average value="7.95" />
        <bayesaverage value="7.80" />
        <stddev value="1.15" />
        <median value="0" />
        <owned value="85000" />
        <trading value="800" />
        <wanting value="500" />
        <wishing value="10000" />
        <numcomments value="6000" />
        <numweights value="3000" />
        <averageweight value="2.23" />
        <ranks>
          <rank type="subtype" id="1" name="boardgame"
                friendlyname="Board Game Rank"
                value="25" bayesaverage="7.80" />
        </ranks>
      </ratings>
    </statistics>
  </item>
</items>
```

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `@type` | String | `boardgame` or `boardgameexpansion` |
| `@id` | Integer | BGG thing ID |
| `thumbnail` | URI | Thumbnail URL |
| `image` | URI | Full image URL |
| `name` | Complex | `type` (primary/alternate), `sortindex`, `value` |
| `description` | String | Full HTML description |
| `yearpublished` | Integer | Year of publication |
| `minplayers` | Integer | Minimum players |
| `maxplayers` | Integer | Maximum players |
| `playingtime` | Integer | Average play time (minutes) |
| `minplaytime` | Integer | Minimum play time |
| `maxplaytime` | Integer | Maximum play time |
| `minage` | Integer | Minimum recommended age |

### Link Types

| Type | Description |
|------|-------------|
| `boardgamecategory` | Categories (Fantasy, Adventure, Card Game...) |
| `boardgamemechanic` | Mechanics (Dice Rolling, Hand Management, Drafting...) |
| `boardgamedesigner` | Designer(s) |
| `boardgameartist` | Artist(s) |
| `boardgamepublisher` | Publisher(s) |
| `boardgamefamily` | Families/series |
| `boardgameexpansion` | Expansions. With `inbound="true"` = this is the base game for the expansion |
| `boardgameimplementation` | Reimplementations. With `inbound="true"` = original game |
| `boardgameintegration` | Games that integrate |
| `boardgamecompilation` | Compilations containing this game |
| `boardgameaccessory` | Related accessories |

### Polls

| Poll name | Description | Results structure |
|-----------|-------------|-------------------|
| `suggested_numplayers` | Best/Recommended/Not Recommended per player count | `<results numplayers="N">` with Best/Recommended/Not Recommended votes |
| `suggested_playerage` | Community-suggested player age | `<results>` with age values and vote counts |
| `language_dependence` | Language dependency level (1-5) | `<results>` with level 1-5, description, and votes |

### Statistics (with `stats=1`)

| Field | Type | Description |
|-------|------|-------------|
| `usersrated` | Integer | Number of users who rated |
| `average` | Decimal | Average rating (0-10) |
| `bayesaverage` | Decimal | Bayesian average / GeekRating |
| `stddev` | Decimal | Standard deviation |
| `median` | Decimal | Median rating |
| `owned` | Integer | Users who own it |
| `trading` | Integer | Users offering for trade |
| `wanting` | Integer | Users wanting it |
| `wishing` | Integer | Users with it on wishlist |
| `numcomments` | Integer | Number of comments |
| `numweights` | Integer | Number of weight ratings |
| `averageweight` | Decimal | Complexity weight (1-5) |
| `ranks` | Array | Ranking positions by category |

### Versions (with `versions=1`)

| Field | Type | Description |
|-------|------|-------------|
| `thumbnail` | URI | Version thumbnail |
| `image` | URI | Version image |
| `canonicalname` | String | Canonical name |
| `name` | String | Version name |
| `yearpublished` | Integer | Year published |
| `productcode` | String | ISBN/product code |
| `width` | Decimal | Box width |
| `length` | Decimal | Box length |
| `depth` | Decimal | Box depth |
| `weight` | Decimal | Physical weight |
| `link` | Complex | Version-specific links (publisher, language) |

### Videos (with `videos=1`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Video ID |
| `title` | String | Video title |
| `category` | String | `review`, `session`, `instructional` |
| `language` | String | Language |
| `link` | URI | Video URL |
| `username` | String | Uploader |
| `postdate` | DateTime | Post date |

### Marketplace (with `marketplace=1`)

| Field | Type | Description |
|-------|------|-------------|
| `listdate` | DateTime | Date listed |
| `price` | Complex | `currency` + `value` |
| `condition` | String | `new`, `likenew`, `verygood`, `good`, `acceptable` |
| `notes` | String | Seller notes |
| `link` | URI | Purchase URL |

### Comments (with `comments=1` or `ratingcomments=1`)

| Field | Type | Description |
|-------|------|-------------|
| `username` | String | Commenter |
| `rating` | Decimal | User rating (or "N/A") |
| `value` | String | Comment text |

---

## API Behavior Notes

- **202 Accepted:** BGG queues collection requests. Retry with exponential backoff until 200.
- **Subtype overlap:** The `subtype=boardgame` call may include expansions with `subtype="boardgame"`. Always use the `subtype=boardgameexpansion` call as the source of truth.
- **Rate limiting:** Batch `/thing` requests (max ~20 IDs per call) and add delays between calls.
- **Revalidation:** Collection data changes infrequently; 24h cache (`revalidate: 86400`) is reasonable.

---

## What We Currently Use

| Field | Source | Used in |
|-------|--------|---------|
| `id` | collection | Game identification |
| `subtype` | collection | Base game / expansion filter |
| `name`, `originalName` | collection | Display + search |
| `yearpublished` | collection | Display |
| `thumbnail`, `image` | collection | Cards + detail modal |
| `minPlayers`, `maxPlayers` | collection stats | Player count filter |
| `playingTime` | collection stats | Duration filter |
| `rating` (average) | collection stats | Sort + display |
| `weight` (averageweight) | thing | Complexity filter + display |
| `minAge` | thing | Age filter |
| `categories` | thing links | Category filter |
| `mechanics` | thing links | Mechanics filter |
| `expansions` | thing links | Expansion linking in detail modal |

## Available but Not Used

| Field | Source | Potential use |
|-------|--------|---------------|
| `description` | thing | Detail modal |
| `designers` | thing links | Display + filter |
| `artists` | thing links | Display |
| `publishers` | thing links | Display + filter |
| `families` | thing links | Series grouping |
| `suggested_numplayers` poll | thing | "Best with X players" badge |
| `suggested_playerage` poll | thing | Community-recommended age |
| `language_dependence` poll | thing | Language dependency indicator |
| `ranks` | stats | Board Game Rank badge |
| `numowned` | collection stats | Popularity indicator |
| `owned`, `trading`, `wanting`, `wishing` | thing stats | Community interest |
| `numplays` | collection | Personal play tracking |
| `versions` | thing | Edition details |
| `videos` | thing | Tutorial/review links |
| `marketplace` | thing | Buy links |
