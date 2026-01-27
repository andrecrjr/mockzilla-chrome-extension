// Changelog data for Mockzilla
export const changelogData = {
  "0.3": {
    title: "Version 0.3: Server Sync & UI Refresh",
    date: "January 2026",
    sections: [
      {
        title: "🚀 New Features",
        items: [
          "**Server Sync (BETA)**: Sync your rules to a Mockzilla server for team collaboration. [Learn more here](https://mockzilla.dev/docs#extension-sync?utm_source=extension&utm_medium=changelog&utm_campaign=v0.3)",
          "**Settings**: Created a new Settings Modal UI to import, export rules and sync to server!",
          "**Contact Form**: Created a new Contact Form to send feedback to the developer aside Settings",
      ]
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
