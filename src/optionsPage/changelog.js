// Changelog data for Mockzilla
export const changelogData = {
  "0.3": {
    title: "Version 0.3: Server Sync & UI Refresh",
    date: "January 2026",
    sections: [
      {
        title: "🚀 New Features",
        items: [
          "**Server Sync (BETA)**: Sync your rules to a Mockzilla server for team collaboration. [Learn more here](https://mockzilla.dev/docs#extension-sync)",
          "**Settings Modal**: Created a new Settings Modal UI to import and export rules and sync to server!",        ]
      },
      // {
      //   title: "🛠️ Improvements",
      //   items: [
      //   ]
      // }
    ]
  }
};

export const getChangelog = (version) => changelogData[version] || null;
