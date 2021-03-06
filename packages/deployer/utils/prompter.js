const inquirer = require('inquirer');

module.exports = {
  noConfirm: false,

  confirmAction: async function (message) {
    if (this.noConfirm) {
      return;
    }

    const { confirmation } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmation',
        message,
      },
    ]);

    if (!confirmation) {
      console.log('User cancelled');

      process.exit(0);
    }
  },
};
