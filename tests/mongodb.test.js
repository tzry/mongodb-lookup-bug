const { after, before, describe, it } = require("mocha");
const { expect } = require("chai");
const _ = require("lodash");
const { MongoClient, ObjectId } = require("mongodb");
const { exec } = require("child_process");
const path = require("path");
const uri = "mongodb://127.0.0.1:27017";

describe("mongodb test", function () {
  let client, database;
  before(async () => {
    await exec(
      `docker cp ${path.join(
        __dirname,
        "../data"
      )}/. mongoLocalBuggy:/home/data/`
    );

    client = new MongoClient(uri);
    database = client.db("test");

    await database.dropDatabase();
    await exec(
      "docker exec mongoLocalBuggy mongoimport -d test -c companies --file /home/data/test.companies.json --jsonArray"
    );
    await exec(
      "docker exec mongoLocalBuggy mongoimport -d test -c subscriptions --file /home/data/test.subscriptions.json --jsonArray"
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });
  after(async () => {
    await client.close();
    await exec("docker container rm -f mongoLocalBuggy");
  });

  it("test aggregation with/without index", async () => {
    const subscriptionsCollection = database.collection("subscriptions");
    const companiesCollection = database.collection("companies");

    const result1 = await companiesCollection
      .aggregate([
        {
          $match: {
            ai: new ObjectId("663da145ecc5e97e00ae63d5"),
          },
        },
        {
          $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "companyId",
            as: "sub",
          },
        },
        { $project: { sub: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    const result1Obj = result1.map((r) => {
      return {
        _id: r._id.toString(),
        subLength: r.sub.length,
      };
    });
    console.log("result1: ", result1);

    await subscriptionsCollection.createIndex({
      companyId: 1,
      status: "hashed",
      category: 1,
    });
    await companiesCollection.createIndex({ ai: "hashed" });
    const result2 = await companiesCollection
      .aggregate([
        {
          $match: {
            ai: new ObjectId("663da145ecc5e97e00ae63d5"),
          },
        },
        {
          $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "companyId",
            as: "sub",
          },
        },
        { $project: { sub: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const result2Obj = result2.map((r) => {
      return {
        _id: r._id.toString(),
        subLength: r.sub.length,
      };
    });
    console.log("result2: ", result2);

    expect(_.isEqual(result1Obj, result2Obj)).true;
  });
});
