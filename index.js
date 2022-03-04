const aws = require("aws-sdk");
const dotenv = require("dotenv").config;

aws.config.update({
  region: process.env.REGION, // ca-central-1
});

const dynamoDb = new aws.DynamoDB.DocumentClient();
const dynamodbTableName = process.env.DYNAMO_DB;
const healthPath = "/health";
const shoePath = "/shoe";
const shoesPath = "/shoes";

exports.handler = async (event) => {
  console.log(`Request event: ${event}`);
  let response;
  switch (true) {
    case event.httpMethod === "GET" && event.path === healthPath:
      response = createResponse(200);
      break;
    case event.httpMethod === "GET" && event.path === shoePath:
      response = await getShoe(event.queryStringParameter.shoeId);
      break;
    case event.httpMethod === "GET" && event.path === shoesPath:
      response = await getShoes();
      break;
    case event.httpMethod === "POST" && event.path === shoePath:
      response = await createShoe(JSON.parse(event.body));
      break;
    case event.httpMethod === "PATCH" && event.path === shoePath:
      const requestBody = JSON.parse(event.body);
      response = await updateShoe(
        requestBody.shoeId,
        requestBody.updateKey,
        requestBody.updateValue
      );
      break;
    case event.httpMethod === "DELETE" && event.path === shoePath:
      response = await deleteShoe(JSON.parse(event.body).shoeId);
      break;
    default:
      console.log("Request ressponse not found");
  }
  return response;
};

const createResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
};

const getShoe = async (shoeId) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      shoeId: shoeId,
    },
  };
  return await dynamoDb
    .get(params)
    .promise()
    .then(
      (response) => {
        return createResponse(200, response.Item);
      },
      (error) => {
        console.log("Error getting the shoe from db ", error);
      }
    );
};

const getShoes = async () => {
  const params = {
    TableName: dynamodbTableName,
  };
  const allShoes = await scanDynamoRecords(params, []);
  const data = {
    shoes: allShoes,
  };
  return createResponse(200, data);
};

const scanDynamoRecords = async (scanParams, itemArray) => {
  try {
    const dynamoData = await dynamoDb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (err) {
    console.log(err);
  }
};

const createShoe = async (shoeData) => {
  const params = {
    TableName: dynamodbTableName,
    Item: shoeData,
  };
  return await dynamoDb
    .put(params)
    .promise()
    .then(
      () => {
        const body = {
          Operation: "SAVE",
          Message: "SUCCESS",
          Item: shoeData,
        };
        return createResponse(200, body);
      },
      (error) => {
        console.log(`Error creating the shoe ${error}`);
      }
    );
};

const updateShoe = async (shoeId, updateKey, updateValue) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      shoeId: shoeId,
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ":value": updateValue,
    },
    ReturnValues: "UPDATED_NEW",
  };
  return await dynamoDb
    .update(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: "UPDATE",
          Message: "SUCCESS",
          Item: response,
        };
        return createResponse(200, body);
      },
      (error) => {
        console.log(`Error updating the shoe ${error}`);
      }
    );
};

const deleteShoe = async (shoeId) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      shoeId: shoeId,
    },
    ReturnValues: "ALL_OLD",
  };
  return await dynamoDb
    .delete(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: "DELETE",
          Message: "SUCCESS",
          Item: response,
        };
        return createResponse(200, body);
      },
      (error) => {
        console.log(`Error deleting shoe ${error}`);
      }
    );
};
