'use strict';

module.exports = class CosmosDbConfiguration {
  constructor(endpointUrl, authKey, databaseId, collectionId) {
    this.endpointUrl = endpointUrl;
    this.authKey = authKey;
    this.databaseId = databaseId;
    this.collectionId = collectionId;
  }
};
