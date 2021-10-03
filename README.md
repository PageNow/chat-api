# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## Dev Notes

* Getting user conversations and sorting it by timestamp is really hard in Dynamodb because queries cannot be sorted. Also, after you get all the conversation ids, you need to use BatchGet to fill in the conversations, but there is a limit of 100 items for batch get
* UserPairId to check quickly whether there exists a conversation between two users
* Use Aurora Serverless since Aurora Cluster access setup is complicated (since private access) - downside is that it is POSTGRES10
* Assume message happens more frequently than listing chats - join latest message rather than using transaction for every message
* Subscribe to messages only - because you don't need to check if it is an empty conversation => assume direct message for now (a lot easier if we don't think about group chat)
* Testing on AWS console is easier
* SQL is better because all the messages have the same format
* When you encounter AWS EC2 address limit exceeded, release elastic ip on console.

## References

* https://docs.aws.amazon.com/cdk/api/latest/docs/aws-appsync-readme.html#Object-Types
* https://aws.amazon.com/ko/blogs/mobile/building-scalable-graphql-apis-on-aws-with-cdk-and-aws-appsync/
* https://www.theelastic.guru/rosius/build-a-graphql-api-on-aws-with-cdk-python-appsync-and-dynamodb-part-1-1pjl


### CDK-DynamoDB

* https://docs.aws.amazon.com/cdk/api/latest/docs/aws-dynamodb-readme.html#amazon-dynamodb-construct-library
* https://appsync-immersionday.workshop.aws/lab1/2_deploy-with-cdk.html
* https://docs.aws.amazon.com/cdk/api/latest/python/aws_cdk.aws_appsync/README.html
* https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/appsync-graphql-dynamodb/index.ts
* https://medium.com/@sam.goodwin1989/type-safe-infrastructure-part-2-graphql-apis-with-aws-appsync-d1225e4e21e3
* https://www.itonaut.com/2018/12/02/define-apigateway-lambda-and-dynamodb-using-aws-cdk/

### AppSync

* https://www.youtube.com/watch?v=j1XghMd1X_I

### Database Query

* https://stackoverflow.com/questions/25536422/optimize-group-by-query-to-retrieve-latest-row-per-user

