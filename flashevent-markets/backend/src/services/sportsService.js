/**
 * Sports API Service
 * 
 * Provides sports data for market resolution using multiple free/freemium APIs:
 * 1. API-Football (football/soccer) - https://api-football.com
 * 2. TheSportsDB (multi-sport) - https://thesportsdb.com  
 * 3. ESPN API (fallback)
 * 
 * Supported Sports:
 * - Football/Soccer (Premier League, La Liga, Champions League, etc.)
 * - Cricket (IPL, World Cup, etc.)
 * - Basketball (NBA)
 * - American Football (NFL)
 * - Baseball (MLB)
 * - Tennis (Grand Slams)
 */

const axios = require('axios');
const logger = require('../utils/logger');

// API Configuration
const API_CONFIG = {
  // TheSportsDB - Free tier (no key required for basic access)
  SPORTSDB: {
    BASE_URL: 'https://www.thesportsdb.com/api/v1/json/3', // Free API key = 3
    TIMEOUT: 10000,
  },
  // API-Football - Requires free API key from https://api-football.com
  API_FOOTBALL: {
    BASE_URL: 'https://v3.football.api-sports.io',
    API_KEY: process.env.API_FOOTBALL_KEY || '',
    TIMEOUT: 10000,
  },
  // ESPN API (unofficial, for fallback)
  ESPN: {
    BASE_URL: 'https://site.api.espn.com/apis/site/v2/sports',
    TIMEOUT: 10000,
  },
};

// Sport type mapping
const SPORT_TYPES = {
  FOOTBALL: 'football',
  SOCCER: 'soccer',
  CRICKET: 'cricket',
  BASKETBALL: 'basketball',
  NBA: 'basketball',
  NFL: 'american_football',
  MLB: 'baseball',
  TENNIS: 'tennis',
  F1: 'motorsport',
  UFC: 'fighting',
  BOXING: 'fighting',
};

// Team name aliases for better matching
const TEAM_ALIASES = {
  // Football/Soccer
  'MAN UTD': 'Manchester United',
  'MAN UNITED': 'Manchester United',
  'MANCHESTER UNITED': 'Manchester United',
  'MAN CITY': 'Manchester City',
  'MANCHESTER CITY': 'Manchester City',
  'LIVERPOOL': 'Liverpool',
  'CHELSEA': 'Chelsea',
  'ARSENAL': 'Arsenal',
  'TOTTENHAM': 'Tottenham Hotspur',
  'SPURS': 'Tottenham Hotspur',
  'BARCELONA': 'Barcelona',
  'BARCA': 'Barcelona',
  'REAL MADRID': 'Real Madrid',
  'MADRID': 'Real Madrid',
  'PSG': 'Paris Saint Germain',
  'PARIS SAINT-GERMAIN': 'Paris Saint Germain',
  'BAYERN': 'Bayern Munich',
  'BAYERN MUNICH': 'Bayern Munich',
  'JUVENTUS': 'Juventus',
  'JUVE': 'Juventus',
  'INTER': 'Inter Milan',
  'INTER MILAN': 'Inter Milan',
  'AC MILAN': 'AC Milan',
  'MILAN': 'AC Milan',
  'DORTMUND': 'Borussia Dortmund',
  
  // Cricket
  'INDIA': 'India',
  'IND': 'India',
  'AUSTRALIA': 'Australia',
  'AUS': 'Australia',
  'ENGLAND': 'England',
  'ENG': 'England',
  'PAKISTAN': 'Pakistan',
  'PAK': 'Pakistan',
  'CSK': 'Chennai Super Kings',
  'CHENNAI': 'Chennai Super Kings',
  'MI': 'Mumbai Indians',
  'MUMBAI': 'Mumbai Indians',
  'RCB': 'Royal Challengers Bangalore',
  'KKR': 'Kolkata Knight Riders',
  
  // NBA
  'LAKERS': 'Los Angeles Lakers',
  'LA LAKERS': 'Los Angeles Lakers',
  'WARRIORS': 'Golden State Warriors',
  'GSW': 'Golden State Warriors',
  'CELTICS': 'Boston Celtics',
  'BOSTON': 'Boston Celtics',
  'BULLS': 'Chicago Bulls',
  'CHICAGO': 'Chicago Bulls',
  'HEAT': 'Miami Heat',
  'MIAMI': 'Miami Heat',
  'NETS': 'Brooklyn Nets',
  'BROOKLYN': 'Brooklyn Nets',
  
  // NFL
  'CHIEFS': 'Kansas City Chiefs',
  'KC CHIEFS': 'Kansas City Chiefs',
  '49ERS': 'San Francisco 49ers',
  'SF 49ERS': 'San Francisco 49ers',
  'EAGLES': 'Philadelphia Eagles',
  'COWBOYS': 'Dallas Cowboys',
  'PATRIOTS': 'New England Patriots',
};

// Demo/test match results for development
const DEMO_RESULTS = {
  'Manchester United vs Liverpool': {
    found: true,
    completed: true,
    source: 'demo',
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    homeScore: 2,
    awayScore: 1,
    winner: 'Manchester United',
    isDraw: false,
    score: '2-1',
    matchDate: new Date().toISOString(),
    league: 'Premier League',
  },
  'India vs Australia': {
    found: true,
    completed: true,
    source: 'demo',
    homeTeam: 'India',
    awayTeam: 'Australia',
    homeScore: 320,
    awayScore: 290,
    winner: 'India',
    isDraw: false,
    score: '320-290',
    matchDate: new Date().toISOString(),
    league: 'Cricket World Cup',
  },
  'Los Angeles Lakers vs Golden State Warriors': {
    found: true,
    completed: true,
    source: 'demo',
    homeTeam: 'Los Angeles Lakers',
    awayTeam: 'Golden State Warriors',
    homeScore: 112,
    awayScore: 108,
    winner: 'Los Angeles Lakers',
    isDraw: false,
    score: '112-108',
    matchDate: new Date().toISOString(),
    league: 'NBA',
  },
  'Kansas City Chiefs vs San Francisco 49ers': {
    found: true,
    completed: true,
    source: 'demo',
    homeTeam: 'Kansas City Chiefs',
    awayTeam: 'San Francisco 49ers',
    homeScore: 25,
    awayScore: 22,
    winner: 'Kansas City Chiefs',
    isDraw: false,
    score: '25-22',
    matchDate: new Date().toISOString(),
    league: 'NFL',
  },
  'Chelsea vs Arsenal': {
    found: true,
    completed: true,
    source: 'demo',
    homeTeam: 'Chelsea',
    awayTeam: 'Arsenal',
    homeScore: 1,
    awayScore: 1,
    winner: null,
    isDraw: true,
    score: '1-1',
    matchDate: new Date().toISOString(),
    league: 'Premier League',
  },
};

// Cache for API responses (TTL: 5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

class SportsService {
  constructor() {
    this.lastApiCall = 0;
    this.rateLimitDelay = 1000; // 1 second between calls
  }

  /**
   * Get match result for resolution
   * @param {string} team1 - First team name
   * @param {string} team2 - Second team name (optional for "Will X win?" questions)
   * @param {string} sport - Sport type
   * @param {Date} matchDate - Approximate match date
   * @returns {Object} Match result data
   */
  async getMatchResult(team1, team2, sport = 'soccer', matchDate = null) {
    logger.info(`Getting match result: ${team1} vs ${team2 || 'any'} (${sport})`);
    
    // Normalize team names
    const normalizedTeam1 = this._normalizeTeamName(team1);
    const normalizedTeam2 = team2 ? this._normalizeTeamName(team2) : null;
    
    // Check demo results first (for development/testing)
    const demoResult = this._checkDemoResult(normalizedTeam1, normalizedTeam2);
    if (demoResult) {
      logger.info(`Using demo result for ${normalizedTeam1} vs ${normalizedTeam2}`);
      return demoResult;
    }
    
    // Try different sources in order
    try {
      // Try TheSportsDB first (free, no key required)
      const sportsDbResult = await this._getFromSportsDB(normalizedTeam1, normalizedTeam2, sport);
      if (sportsDbResult) {
        return sportsDbResult;
      }
    } catch (error) {
      logger.warn('SportsDB fetch failed:', error.message);
    }

    try {
      // Try ESPN API as fallback
      const espnResult = await this._getFromESPN(normalizedTeam1, normalizedTeam2, sport);
      if (espnResult) {
        return espnResult;
      }
    } catch (error) {
      logger.warn('ESPN fetch failed:', error.message);
    }

    // Try API-Football for soccer
    if ((sport === 'soccer' || sport === 'football') && API_CONFIG.API_FOOTBALL.API_KEY) {
      try {
        const apiFootballResult = await this._getFromAPIFootball(normalizedTeam1, normalizedTeam2);
        if (apiFootballResult) {
          return apiFootballResult;
        }
      } catch (error) {
        logger.warn('API-Football fetch failed:', error.message);
      }
    }

    throw new Error(`Could not find match result for ${team1} vs ${team2 || 'opponent'}`);
  }

  /**
   * Get match result from TheSportsDB
   */
  async _getFromSportsDB(team1, team2, sport) {
    const cacheKey = `sportsdb_${team1}_${team2}_${sport}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    await this._rateLimit();

    // Search for team's recent events
    const searchUrl = `${API_CONFIG.SPORTSDB.BASE_URL}/searchevents.php?e=${encodeURIComponent(team1)}`;
    
    try {
      const response = await axios.get(searchUrl, {
        timeout: API_CONFIG.SPORTSDB.TIMEOUT,
      });

      const events = response.data?.event || [];
      
      // Filter for completed events involving the team
      const completedEvents = events.filter(e => {
        const hasScore = e.intHomeScore !== null && e.intAwayScore !== null;
        const isRecent = this._isRecentEvent(e.dateEvent);
        const matchesTeam2 = !team2 || 
          e.strHomeTeam.toUpperCase().includes(team2.toUpperCase()) ||
          e.strAwayTeam.toUpperCase().includes(team2.toUpperCase());
        return hasScore && isRecent && matchesTeam2;
      });

      if (completedEvents.length === 0) {
        logger.debug('No completed events found in SportsDB');
        return null;
      }

      // Get most recent completed event
      const event = completedEvents[0];
      
      const result = this._formatSportsDBResult(event, team1);
      this._setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.error('SportsDB API error:', error.message);
      throw error;
    }
  }

  /**
   * Get match result from ESPN API
   */
  async _getFromESPN(team1, team2, sport) {
    const cacheKey = `espn_${team1}_${team2}_${sport}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    await this._rateLimit();

    // Map sport to ESPN endpoint
    const espnSport = this._mapSportToESPN(sport);
    if (!espnSport) return null;

    const url = `${API_CONFIG.ESPN.BASE_URL}/${espnSport.category}/${espnSport.league}/scoreboard`;
    
    try {
      const response = await axios.get(url, {
        timeout: API_CONFIG.ESPN.TIMEOUT,
      });

      const events = response.data?.events || [];
      
      // Find matching event
      const matchingEvent = events.find(e => {
        const competitors = e.competitions?.[0]?.competitors || [];
        const team1Match = competitors.some(c => 
          c.team?.displayName?.toUpperCase().includes(team1.toUpperCase()) ||
          c.team?.abbreviation?.toUpperCase() === team1.toUpperCase()
        );
        const team2Match = !team2 || competitors.some(c =>
          c.team?.displayName?.toUpperCase().includes(team2.toUpperCase()) ||
          c.team?.abbreviation?.toUpperCase() === team2.toUpperCase()
        );
        const isCompleted = e.status?.type?.completed === true;
        return team1Match && team2Match && isCompleted;
      });

      if (!matchingEvent) {
        logger.debug('No matching event found in ESPN');
        return null;
      }

      const result = this._formatESPNResult(matchingEvent, team1);
      this._setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.error('ESPN API error:', error.message);
      throw error;
    }
  }

  /**
   * Get match result from API-Football
   */
  async _getFromAPIFootball(team1, team2) {
    if (!API_CONFIG.API_FOOTBALL.API_KEY) {
      return null;
    }

    const cacheKey = `apifootball_${team1}_${team2}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    await this._rateLimit();

    // First, search for team ID
    const searchUrl = `${API_CONFIG.API_FOOTBALL.BASE_URL}/teams`;
    
    try {
      const searchResponse = await axios.get(searchUrl, {
        params: { search: team1 },
        headers: {
          'x-rapidapi-key': API_CONFIG.API_FOOTBALL.API_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
        timeout: API_CONFIG.API_FOOTBALL.TIMEOUT,
      });

      const teams = searchResponse.data?.response || [];
      if (teams.length === 0) return null;

      const teamId = teams[0].team.id;

      // Get fixtures for the team
      const fixturesUrl = `${API_CONFIG.API_FOOTBALL.BASE_URL}/fixtures`;
      const fixturesResponse = await axios.get(fixturesUrl, {
        params: {
          team: teamId,
          last: 10, // Last 10 matches
        },
        headers: {
          'x-rapidapi-key': API_CONFIG.API_FOOTBALL.API_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
        timeout: API_CONFIG.API_FOOTBALL.TIMEOUT,
      });

      const fixtures = fixturesResponse.data?.response || [];
      
      // Find matching fixture
      const matchingFixture = fixtures.find(f => {
        const isFinished = f.fixture.status.short === 'FT';
        const matchesTeam2 = !team2 || 
          f.teams.home.name.toUpperCase().includes(team2.toUpperCase()) ||
          f.teams.away.name.toUpperCase().includes(team2.toUpperCase());
        return isFinished && matchesTeam2;
      });

      if (!matchingFixture) return null;

      const result = this._formatAPIFootballResult(matchingFixture, team1);
      this._setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.error('API-Football error:', error.message);
      throw error;
    }
  }

  /**
   * Parse sports question to extract teams and sport type
   * Examples:
   * - "Will Manchester United win against Liverpool?"
   * - "Will India beat Australia in the cricket match?"
   * - "Lakers vs Warriors - will Lakers win?"
   * - "Will Arsenal beat Chelsea?"
   */
  parseQuestion(question) {
    const result = {
      team1: null,
      team2: null,
      sport: 'soccer', // default
      questionType: 'WIN', // WIN, SCORE_OVER, DRAW, etc.
      targetValue: null,
    };

    const upperQuestion = question.toUpperCase();

    // Detect sport type
    if (upperQuestion.includes('CRICKET') || upperQuestion.includes('IPL') || 
        upperQuestion.includes('TEST MATCH') || upperQuestion.includes('ODI') ||
        upperQuestion.includes('T20')) {
      result.sport = 'cricket';
    } else if (upperQuestion.includes('NBA') || upperQuestion.includes('BASKETBALL')) {
      result.sport = 'basketball';
    } else if (upperQuestion.includes('NFL') || upperQuestion.includes('SUPER BOWL')) {
      result.sport = 'american_football';
    } else if (upperQuestion.includes('MLB') || upperQuestion.includes('BASEBALL')) {
      result.sport = 'baseball';
    } else if (upperQuestion.includes('TENNIS') || upperQuestion.includes('GRAND SLAM') ||
               upperQuestion.includes('WIMBLEDON') || upperQuestion.includes('US OPEN')) {
      result.sport = 'tennis';
    } else if (upperQuestion.includes('F1') || upperQuestion.includes('FORMULA')) {
      result.sport = 'motorsport';
    } else if (upperQuestion.includes('UFC') || upperQuestion.includes('BOXING') ||
               upperQuestion.includes('MMA')) {
      result.sport = 'fighting';
    }

    // Extract teams using aliases - track their position in the question
    const teamPositions = [];
    for (const [alias, teamName] of Object.entries(TEAM_ALIASES)) {
      const pos = upperQuestion.indexOf(alias);
      if (pos !== -1) {
        // Check if we already have this team (avoid duplicates from multiple aliases)
        const existing = teamPositions.find(t => t.name === teamName);
        if (!existing) {
          teamPositions.push({ name: teamName, position: pos, alias });
        } else if (pos < existing.position) {
          // Use earlier position if same team found via different alias
          existing.position = pos;
        }
      }
    }
    
    // Sort by position in question (team1 = the one being asked about, typically first)
    teamPositions.sort((a, b) => a.position - b.position);
    
    if (teamPositions.length >= 1) {
      result.team1 = teamPositions[0].name;
    }
    if (teamPositions.length >= 2) {
      result.team2 = teamPositions[1].name;
    }

    // If no team found via aliases, try to extract from "X vs Y" or "X beat Y" pattern
    if (!result.team1) {
      // Try "Will X win/beat Y" pattern
      const willWinMatch = question.match(/will\s+(\w+(?:\s+\w+)*)\s+(?:win|beat|defeat)\s+(?:against\s+)?(\w+(?:\s+\w+)*)/i);
      if (willWinMatch) {
        result.team1 = willWinMatch[1].trim();
        result.team2 = willWinMatch[2].trim();
      } else {
        // Try "X vs Y" pattern
        const vsMatch = question.match(/(\w+(?:\s+\w+)*)\s+(?:vs\.?|versus|against)\s+(\w+(?:\s+\w+)*)/i);
        if (vsMatch) {
          result.team1 = vsMatch[1].trim();
          result.team2 = vsMatch[2].trim();
        }
      }
    }

    // Detect question type
    if (upperQuestion.includes('SCORE') && upperQuestion.includes('OVER')) {
      result.questionType = 'SCORE_OVER';
      const scoreMatch = question.match(/(\d+)/);
      if (scoreMatch) {
        result.targetValue = parseInt(scoreMatch[1]);
      }
    } else if (upperQuestion.includes('DRAW')) {
      result.questionType = 'DRAW';
    } else {
      result.questionType = 'WIN';
    }

    logger.debug(`Parsed sports question: "${question.substring(0, 50)}..."`, result);
    
    return result;
  }

  /**
   * Determine outcome for sports market
   * @param {string} team1 - The team that should win (from question)
   * @param {string} team2 - The opposing team
   * @param {Object} matchResult - Match result from API
   * @param {string} questionType - Type of question (WIN, DRAW, SCORE_OVER)
   * @param {number} targetValue - Target value for score questions
   * @returns {boolean|null} true=YES, false=NO, null=unknown
   */
  determineOutcome(team1, team2, matchResult, questionType = 'WIN', targetValue = null) {
    if (!matchResult || !matchResult.completed) {
      logger.warn('Match not completed or no result data');
      return null;
    }

    logger.debug(`Determining outcome: team1=${team1}, questionType=${questionType}, winner=${matchResult.winner}`);

    switch (questionType) {
      case 'WIN':
        // Check if team1 won - need to match team name
        // If it's a draw, team1 didn't win
        if (matchResult.isDraw) {
          logger.info(`WIN check: DRAW - ${team1} did not win`);
          return false;
        }
        
        const winnerName = matchResult.winner?.toUpperCase() || '';
        const team1Upper = (team1 || '').toUpperCase();
        
        // Try exact match first, then partial
        const team1Won = winnerName === team1Upper || 
                         winnerName.includes(team1Upper) ||
                         team1Upper.includes(winnerName.split(' ')[0]); // First word match
        
        logger.info(`WIN check: winner="${matchResult.winner}", team1="${team1}", result=${team1Won}`);
        return team1Won;
        
      case 'DRAW':
        return matchResult.isDraw === true;
        
      case 'SCORE_OVER':
        const totalScore = (matchResult.homeScore || 0) + (matchResult.awayScore || 0);
        return totalScore > (targetValue || 0);
        
      default:
        logger.warn(`Unknown question type: ${questionType}`);
        return null;
    }
  }

  // Helper methods

  _normalizeTeamName(name) {
    if (!name) return name;
    const upper = name.toUpperCase().trim();
    return TEAM_ALIASES[upper] || name;
  }

  _isRecentEvent(dateString) {
    if (!dateString) return false;
    const eventDate = new Date(dateString);
    const now = new Date();
    const daysDiff = (now - eventDate) / (1000 * 60 * 60 * 24);
    return daysDiff >= 0 && daysDiff <= 7; // Within last 7 days
  }

  _formatSportsDBResult(event, team1) {
    const homeTeam = event.strHomeTeam;
    const awayTeam = event.strAwayTeam;
    const homeScore = parseInt(event.intHomeScore) || 0;
    const awayScore = parseInt(event.intAwayScore) || 0;
    
    let winner = null;
    if (homeScore > awayScore) winner = homeTeam;
    else if (awayScore > homeScore) winner = awayTeam;

    // Determine if team1 is home or away
    const team1IsHome = homeTeam.toUpperCase().includes(team1.toUpperCase());
    const team1Score = team1IsHome ? homeScore : awayScore;
    const team2Score = team1IsHome ? awayScore : homeScore;

    return {
      completed: true,
      source: 'TheSportsDB',
      matchId: event.idEvent,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      team1Score,
      team2Score,
      winner,
      isDraw: homeScore === awayScore,
      matchDate: event.dateEvent,
      league: event.strLeague,
    };
  }

  _formatESPNResult(event, team1) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    
    const homeTeam = competitors.find(c => c.homeAway === 'home');
    const awayTeam = competitors.find(c => c.homeAway === 'away');
    
    const homeScore = parseInt(homeTeam?.score) || 0;
    const awayScore = parseInt(awayTeam?.score) || 0;
    
    let winner = null;
    if (homeScore > awayScore) winner = homeTeam?.team?.displayName;
    else if (awayScore > homeScore) winner = awayTeam?.team?.displayName;

    return {
      completed: true,
      source: 'ESPN',
      matchId: event.id,
      homeTeam: homeTeam?.team?.displayName,
      awayTeam: awayTeam?.team?.displayName,
      homeScore,
      awayScore,
      winner,
      isDraw: homeScore === awayScore,
      matchDate: event.date,
      league: event.league?.name,
    };
  }

  _formatAPIFootballResult(fixture, team1) {
    const homeTeam = fixture.teams.home.name;
    const awayTeam = fixture.teams.away.name;
    const homeScore = fixture.goals.home || 0;
    const awayScore = fixture.goals.away || 0;
    
    let winner = null;
    if (homeScore > awayScore) winner = homeTeam;
    else if (awayScore > homeScore) winner = awayTeam;

    return {
      completed: true,
      source: 'API-Football',
      matchId: fixture.fixture.id,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      winner,
      isDraw: homeScore === awayScore,
      matchDate: fixture.fixture.date,
      league: fixture.league.name,
    };
  }

  _mapSportToESPN(sport) {
    const mapping = {
      soccer: { category: 'soccer', league: 'eng.1' }, // Premier League
      basketball: { category: 'basketball', league: 'nba' },
      american_football: { category: 'football', league: 'nfl' },
      baseball: { category: 'baseball', league: 'mlb' },
    };
    return mapping[sport] || null;
  }

  /**
   * Check demo results for development/testing
   * @param {string} team1 - First team name
   * @param {string} team2 - Second team name
   * @returns {Object|null} Demo result or null
   */
  _checkDemoResult(team1, team2) {
    if (!team2) return null;
    
    // Try exact match
    const key1 = `${team1} vs ${team2}`;
    const key2 = `${team2} vs ${team1}`;
    
    if (DEMO_RESULTS[key1]) {
      return { ...DEMO_RESULTS[key1] };
    }
    if (DEMO_RESULTS[key2]) {
      // Swap home/away for reversed lookup
      const result = { ...DEMO_RESULTS[key2] };
      return result;
    }
    
    // Try fuzzy match
    for (const [matchKey, result] of Object.entries(DEMO_RESULTS)) {
      const lowerKey = matchKey.toLowerCase();
      const lowerTeam1 = team1.toLowerCase();
      const lowerTeam2 = team2.toLowerCase();
      
      if (lowerKey.includes(lowerTeam1) && lowerKey.includes(lowerTeam2)) {
        return { ...result };
      }
    }
    
    return null;
  }

  _getFromCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug(`Cache hit for ${key}`);
      return cached.data;
    }
    return null;
  }

  _setCache(key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  async _rateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
    }
    this.lastApiCall = Date.now();
  }

  /**
   * Get supported sports and example teams
   * @returns {Object} Supported sports configuration
   */
  getSupportedSports() {
    return {
      sports: [
        {
          id: 'soccer',
          name: 'Football/Soccer',
          leagues: ['Premier League', 'La Liga', 'Champions League', 'Bundesliga', 'Serie A', 'Ligue 1'],
          exampleTeams: ['Manchester United', 'Liverpool', 'Chelsea', 'Barcelona', 'Real Madrid', 'PSG'],
        },
        {
          id: 'cricket',
          name: 'Cricket',
          leagues: ['IPL', 'World Cup', 'Test Series', 'T20 World Cup'],
          exampleTeams: ['India', 'Australia', 'England', 'CSK', 'Mumbai Indians', 'RCB'],
        },
        {
          id: 'basketball',
          name: 'NBA Basketball',
          leagues: ['NBA', 'NBA Playoffs', 'NBA Finals'],
          exampleTeams: ['Lakers', 'Warriors', 'Celtics', 'Bulls', 'Heat', 'Nets'],
        },
        {
          id: 'american_football',
          name: 'NFL Football',
          leagues: ['NFL', 'NFL Playoffs', 'Super Bowl'],
          exampleTeams: ['Chiefs', '49ers', 'Eagles', 'Cowboys', 'Patriots'],
        },
        {
          id: 'baseball',
          name: 'MLB Baseball',
          leagues: ['MLB', 'World Series'],
          exampleTeams: ['Yankees', 'Dodgers', 'Red Sox', 'Cubs'],
        },
        {
          id: 'tennis',
          name: 'Tennis',
          leagues: ['Wimbledon', 'US Open', 'French Open', 'Australian Open'],
          exampleTeams: ['Djokovic', 'Alcaraz', 'Sinner', 'Nadal'],
        },
      ],
      questionFormats: [
        {
          type: 'WIN',
          examples: [
            'Will Manchester United win against Liverpool?',
            'Will India beat Australia in the World Cup?',
            'Will Lakers win the NBA Finals?',
          ],
        },
        {
          type: 'SCORE',
          examples: [
            'Will Manchester United score more than 2 goals against Liverpool?',
            'Will India score more than 300 runs?',
          ],
        },
      ],
      teamAliases: Object.keys(TEAM_ALIASES).slice(0, 20), // Show first 20 aliases
    };
  }
}

module.exports = new SportsService();
