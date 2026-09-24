const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');

const app = express();

// Schema
const schema = buildSchema(`
  type User {
    id: ID
    name: String
  }

  type Query {
    user(id: ID!): User
  }
`);

// Fake Data
const users = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" }
];

// Resolver
const root = {
  user: ({ id }) => users.find(u => u.id === id)
};

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');