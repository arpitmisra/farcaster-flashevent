import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'flashevent://', 'wc://', 'metamask://'],
  config: {
    screens: {
      // Auth screens
      Splash: 'splash',
      FarcasterAuth: 'auth/farcaster',
      
      // Main app
      Main: {
        screens: {
          Home: 'home',
          Create: {
            screens: {
              CreateMarketMain: 'create',
              TemplateSelect: 'create/template',
              ConfirmMarket: 'create/confirm',
            },
          },
          MyBets: {
            screens: {
              MyBetsMain: 'bets',
              BetDetail: 'bets/:betId',
            },
          },
          Social: 'social',
          Profile: 'profile',
        },
      },
      
      // Stack screens
      MarketDetail: 'market/:marketAddress',
      UserProfile: 'user/:username',
      Settings: 'settings',
    },
  },
};

export default linking;
