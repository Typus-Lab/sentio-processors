
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type { String, Int, BigInt, Float, ID, Bytes, Timestamp, Boolean } from '@sentio/sdk/store'
import { Entity, Required, One, Many, Column, ListColumn, AbstractEntity } from '@sentio/sdk/store'
import { BigDecimal } from '@sentio/bigdecimal'
import { DatabaseSchema } from '@sentio/sdk'






@Entity("UserMarkets")
export class UserMarkets extends AbstractEntity  {

	@Required
	@Column("String")
	id: String

	@Required
	@ListColumn("String!")
	markets: Array<String>
  constructor(data: Partial<UserMarkets>) {super()}
}


const source = `type UserMarkets @entity {
  id: String!
  markets: [String!]!
}
`
DatabaseSchema.register({
  source,
  entities: {
    "UserMarkets": UserMarkets
  }
})
