// config.template.ts is tracked in git
// config.ts is not tracked in git
//
// This allows us to track the starting recommendations for the config without
// getting mixed up with local preferences.
//
// If config.ts doesn't yet exist, it will be created as a copy of the template
// during `yarn setup`.

import ConfigType from './ConfigType';

const config: ConfigType = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: 'yourEmailAddress',
    pass: 'yourEmailPassword'
  }
};

export default config;