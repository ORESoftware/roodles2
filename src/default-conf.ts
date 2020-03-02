'use strict';

export const getOverride = () => {
  return {
    exec: '',
    processLogPath: '',
    signal: '',
    include: [] as Array<string>,
    exclude: [] as Array<string>,
    restartUponChange: true,
    restartUponAddition: true,
    restartUponUnlink: true,
    processArgs: [] as Array<string>,
    verbosity: 1
  };
};

export const getDefaultConf = (projectRoot: string) => {
  return {
    verbosity: 2,
    signal: 'SIGINT',
    processArgs: [],
    restartUponChange: true,
    restartUponAddition: false,
    restartUponUnlink: false,
    include: projectRoot,
    exclude: [
      /node_modules/,
      /public/,
      /bower_components/,
      /.git/,
      /.idea/,
      /package.json/,
      /test/
    ]
  };
};
