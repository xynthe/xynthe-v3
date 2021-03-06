const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { SUBTASK_SYNC_SOURCES } = require('../task-names');

/*
 * Synchronizes the deployment file with the latest module sources.
 * I.e. if a module was removed from the sources, the associated entry
 * is deleted from the deployment file, and viceversa.
 * */
subtask(SUBTASK_SYNC_SOURCES).setAction(async (_, hre) => {
  logger.subtitle('Syncing solidity sources with deployment data');

  const data = hre.deployer.data;
  const sources = (hre.deployer.sources = _getSources());

  const someDeletion = await _removeDeletedSources({ data, sources });
  const someAddition = await _addNewSources({ data, sources });

  if (!someDeletion && !someAddition) {
    logger.checked('Deployment data is in sync with sources');
  }
});

function _getSources() {
  const modulesPath = hre.config.deployer.paths.modules;

  return fs.readdirSync(modulesPath).map((file) => {
    const filePath = path.parse(file);
    if (filePath.ext === '.sol') {
      return filePath.name;
    }
  });
}

async function _removeDeletedSources({ data, sources }) {
  let someDeletion = false;

  Object.keys(data.contracts.modules).map((deployedModule) => {
    if (!sources.some((source) => deployedModule === source)) {
      logger.notice(
        `Previously deployed module "${deployedModule}" was not found in sources, so it will not be included in the deployment`
      );

      someDeletion = true;

      delete data.contracts.modules[deployedModule];
    }
  });

  if (someDeletion) {
    await prompter.confirmAction('Do you confirm removing these modules');
  }

  return someDeletion;
}

async function _addNewSources({ data, sources }) {
  let someAddition = false;

  sources.map((source) => {
    if (!data.contracts.modules[source]) {
      logger.notice(`Found new module "${source}", including it for deployment`);

      someAddition = true;

      data.contracts.modules[source] = {
        deployedAddress: '',
        bytecodeHash: '',
      };
    }
  });

  if (someAddition) {
    await prompter.confirmAction('Do you confirm these new modules');
  }

  return someAddition;
}
