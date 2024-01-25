'use strict';

const documentClient = require('documentdb').DocumentClient;
const uriFactory = require('documentdb').UriFactory;

module.exports = class CosmosDbRepository {
  constructor(dbConfiguration) {
    if (!dbConfiguration)
      throw new Error('CosmosDb configurations not provided.');

    this.client = new documentClient(dbConfiguration.endpointUrl, {
      masterKey: dbConfiguration.authKey,
    });
    this.HttpStatusCodes = { NOTFOUND: 404, ALREADYEXISTS: 409 };
    this.databaseId = dbConfiguration.databaseId;
    this.collectionId = dbConfiguration.collectionId;

    this.ensureDatabase = function (databaseId) {
      return new Promise((resolve, reject) => {
        this.client.readDatabase(
          uriFactory.createDatabaseUri(databaseId),
          (err, database) => {
            if (database) resolve();
            else if (err && err.code == this.HttpStatusCodes.NOTFOUND) {
              this.client.createDatabase({ id: databaseId }, (err) => {
                if (err && err.code == this.HttpStatusCodes.ALREADYEXISTS)
                  resolve();
                else if (err) reject(err);
                else resolve();
              });
            } else reject(err);
          }
        );
      });
    };

    this.ensureCollection = function (databaseId, collectionId) {
      return new Promise((resolve, reject) => {
        this.client.readCollection(
          uriFactory.createDocumentCollectionUri(databaseId, collectionId),
          (err, collection) => {
            if (collection) resolve();
            else if (err && err.code == this.HttpStatusCodes.NOTFOUND) {
              this.client.createCollection(
                uriFactory.createDatabaseUri(databaseId),
                { id: collectionId },
                { offerThroughput: 400 },
                (err) => {
                  if (err && err.code == this.HttpStatusCodes.ALREADYEXISTS)
                    resolve();
                  if (err) reject(err);
                  else resolve();
                }
              );
            } else reject(err);
          }
        );
      });
    };

    // Create DB and collection if they don't exist
    this.ensureDatabase(this.databaseId)
      .then(() => this.ensureCollection(this.databaseId, this.collectionId))
      .catch((error) => {
        throw error;
      });
  }

  getById(id) {
    return new Promise((resolve, reject) => {
      // If the ID isn't provided - return null
      if (!id) return resolve(null);
      this.client.readDocument(
        uriFactory.createDocumentUri(this.databaseId, this.collectionId, id),
        (err, result) => {
          if (err && err.code == this.HttpStatusCodes.NOTFOUND) resolve(null);
          else if (err) reject(err);
          else resolve(result);
        }
      );
    });
  }

  remove(id) {
    return new Promise((resolve, reject) => {
      // If the ID isn't provided - return null
      if (!id) return resolve(null);
      this.getById(id)
        .then((document) => {
          // If there was no document found - don't need to delete it.
          if (!document) return resolve(null);
          this.client.deleteDocument(
            uriFactory.createDocumentUri(
              this.databaseId,
              this.collectionId,
              document.id
            ),
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        })
        .catch((error) => reject(error));
    });
  }

  find(querySpec) {
    return new Promise((resolve, reject) => {
      if (!querySpec) return reject('Query specification not provided.');
      this.client
        .queryDocuments(
          uriFactory.createDocumentCollectionUri(
            this.databaseId,
            this.collectionId
          ),
          querySpec
        )
        .toArray((err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
    });
  }

  save(document, options) {
    return new Promise((resolve, reject) => {
      if (!document) return reject('Document to save was not provided.');
      this.getById(document.id)
        .then((result) => {
          // If the document was found - update the properties from the new document to persist
          if (result) {
            // Set the ID of the latest document to the database stored record.
            const documentId = result.id;
            // Combine the updated properties from the document to the database result.
            Object.assign(result, document);
            result.id = documentId;
            // Update the document with the latest properties
            this.client.replaceDocument(
              uriFactory.createDocumentUri(
                this.databaseId,
                this.collectionId,
                result.id
              ),
              result,
              (err, updated) => {
                if (err) reject(err);
                else resolve(updated);
              }
            );
            return;
          }
          // If the document was NOT found create one.
          this.client.createDocument(
            uriFactory.createDocumentCollectionUri(
              this.databaseId,
              this.collectionId
            ),
            document,
            options,
            (err, created) => {
              if (err) reject(err);
              else resolve(created);
            }
          );
        })
        .catch((error) => reject(error));
    });
  }
};
