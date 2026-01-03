import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateUserCardsTable1735689600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_cards',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'wompi_payment_source_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'card_last_four',
            type: 'varchar',
            length: '4',
            isNullable: false,
          },
          {
            name: 'card_brand',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'card_holder_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'exp_month',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'exp_year',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'user_cards',
      new TableIndex({
        name: 'IDX_user_cards_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_cards',
      new TableIndex({
        name: 'IDX_user_cards_wompi_payment_source_id',
        columnNames: ['wompi_payment_source_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'user_cards',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_user_cards_user_id',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_cards');
    if (table) {
      const foreignKey = table.foreignKeys.find((fk) => fk.name === 'FK_user_cards_user_id');
      if (foreignKey) {
        await queryRunner.dropForeignKey('user_cards', foreignKey);
      }
    }

    await queryRunner.dropIndex('user_cards', 'IDX_user_cards_wompi_payment_source_id');
    await queryRunner.dropIndex('user_cards', 'IDX_user_cards_user_id');
    await queryRunner.dropTable('user_cards');
  }
}

