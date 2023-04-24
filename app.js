const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
let db = "";
let fileName = path.join(__dirname, "twitterClone.db");

const initializaDbAndServer = async () => {
  try {
    db = await open({
      filename: fileName,
      driver: sqlite3.Database,
    });
    console.log("DB Connection Successfull");
    app.listen(3000, () => {
      console.log("Server Connection Successfull");
    });
  } catch (e) {
    console.log(`The Error is ${e.message}`);
  }
};
initializaDbAndServer();

const authorizationFunc = async (request, response, next) => {
  let givenToken = request.headers["authorization"];
  let jwtToken;
  if (givenToken !== undefined) {
    jwtToken = givenToken.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", (err, payload) => {
      if (err) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  let { username, password, name, gender } = request.body;
  let hashedPw = await bcrypt.hash(password, 10);
  let dbResponse;
  let userNameCheck = `
        SELECT * FROM user 
        WHERE username = '${username}';
    `;
  dbResponse = await db.all(userNameCheck);
  if (dbResponse.length !== 0) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      let createUserQuery = `
            INSERT INTO user(name,username,password,gender)
            VALUES ('${name}','${username}','${hashedPw}','${gender}');
        `;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  //let hashedPw = await bcrypt.hash(password, 10);
  let dbResponse;
  let userNameCheck = `
            SELECT * FROM user 
            WHERE username = '${username}'
            ;
        `;
  dbResponse = await db.get(userNameCheck);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let passwordCheck = await bcrypt.compare(password, dbResponse.password);
    if (passwordCheck === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      let jwtToken = await jwt.sign(username, "MY_SECRET_KEY");
      response.send({ jwtToken });
      console.log(jwtToken);
    }
  }
});

app.get("/user/tweets/feed/", authorizationFunc, async (request, response) => {
  let dbResponse;
  let sqlQuery = `
        SELECT user.username AS username,
        tweet.tweet AS tweet,
        tweet.date_time AS dateTime
        FROM 
        follower LEFT JOIN tweet 
        ON follower.following_user_id = tweet.user_id 
        LEFT JOIN user 
        ON tweet.user_id = user.user_id 
        ORDER BY tweet.date_time DESC
        LIMIT 4
        ;
        
    `;
  dbResponse = await db.all(sqlQuery);
  response.send(dbResponse);
  console.log(dbResponse);
});

app.get("/user/following/", authorizationFunc, async (request, response) => {
  let dbResponse;
  let sqlQuery = `
        SELECT DISTINCT user.username AS name
        FROM 
        follower LEFT JOIN user 
        ON follower.following_user_id = user.user_id 
        ;
        
    `;
  dbResponse = await db.all(sqlQuery);
  response.send(dbResponse);
  console.log(dbResponse);
});

app.get("/user/followers/", authorizationFunc, async (request, response) => {
  let dbResponse;
  let sqlQuery = `
        SELECT DISTINCT user.username AS name
        FROM 
        follower LEFT JOIN user 
        ON follower.follower_user_id = user.user_id 
        ;
        
    `;
  dbResponse = await db.all(sqlQuery);
  response.send(dbResponse);
  console.log(dbResponse);
});

app.get("/tweets/:tweetId/", authorizationFunc, async (request, response) => {
  let dbResponse;
  let { tweetId } = request.params;
  let sqlQuery = `
        SELECT tweet.tweet AS tweet,
        COUNT(like.like_id) AS likes,
        COUNT(reply.reply_id) AS replies,
        tweet.date_time AS dateTime
        FROM 
        follower LEFT JOIN tweet 
        ON follower.following_user_id = tweet.user_id 
        LEFT JOIN reply 
        ON tweet.tweet_id = reply.tweet_id 
        LEFT JOIN like 
        ON reply.tweet_id = like.tweet_id
        WHERE tweet.tweet_id = ${tweetId};
        ;
    `;
  dbResponse = await db.all(sqlQuery);
  if (dbResponse.length === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(dbResponse);
    console.log(dbResponse);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authorizationFunc,
  async (request, response) => {
    let dbResponse;
    let { tweetId } = request.params;
    let sqlQuery = `
        SELECT DISTINCT user.username AS name
        FROM 
        follower LEFT JOIN tweet 
        ON follower.following_user_id = tweet.user_id 
        LEFT JOIN like 
        ON tweet.tweet_id = like.tweet_id
        LEFT JOIN user 
        ON user.user_id = like.user_id
        WHERE tweet.tweet_id = ${tweetId};
        ;
    `;
    dbResponse = await db.all(sqlQuery);
    if (dbResponse.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      let resNamesArr = [];
      for (let each of dbResponse) {
        resNamesArr.push(each.name);
      }
      console.log(`{likes: ${resNamesArr}}`);
      response.send(`{"likes": [${resNamesArr}]}`);
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authorizationFunc,
  async (request, response) => {
    try {
      let dbResponse;
      let { tweetId } = request.params;
      let sqlQuery = `
                SELECT user.name AS name,
                reply.reply AS reply
                FROM 
                follower LEFT JOIN tweet 
                ON follower.following_user_id = tweet.user_id 
                LEFT JOIN reply
                ON tweet.tweet_id = reply.tweet_id
                LEFT JOIN user 
                ON user.user_id = reply.user_id
                WHERE tweet.tweet_id = ${tweetId};
                ;
            `;
      dbResponse = await db.all(sqlQuery);
      if (dbResponse.length === 0) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        console.log({ replies: dbResponse });
        response.send({ replies: dbResponse });
      }
    } catch (e) {
      console.log(`The Error is ${e.message}`);
    }
  }
);

app.get("/user/tweets/", authorizationFunc, async (request, response) => {
  let dbResponse;

  let sqlQuery = `
        SELECT tweet.tweet AS tweet,
        COUNT(like.like_id) AS likes,
        COUNT(reply.reply_id) AS replies,
        tweet.date_time AS dateTime
        FROM 
        user LEFT JOIN tweet 
        ON user.user_id = tweet.user_id 
        LEFT JOIN reply 
        ON tweet.tweet_id = reply.tweet_id 
        LEFT JOIN like 
        ON reply.tweet_id = like.tweet_id
        WHERE tweet.tweet_id = ${tweetId};
        ;
    `;
  dbResponse = await db.all(sqlQuery);
  response.send(dbResponse);
  console.log(dbResponse);
});

app.post("/user/tweets/", authorizationFunc, async (request, response) => {
  let dbResponse;
  let { tweet } = request.body;

  let sqlQuery = `
        INSERT INTO tweet (tweet)
        values ('${tweet}')
        ;
    `;
  await db.run(sqlQuery);
  response.send("Created a Tweet");
  console.log("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authorizationFunc,
  async (request, response) => {
    let { tweetId } = request.params;
    let sqlQuery = `
    DELETE FROM tweet 
    WHERE tweet_id = ${tweetId}
    `;
    let dbResponse = await db.run(sqlQuery);
    if (dbResponse !== undefined) {
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
