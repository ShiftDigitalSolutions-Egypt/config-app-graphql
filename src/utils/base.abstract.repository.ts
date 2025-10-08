import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as _ from 'lodash';
import {
  ClientSession,
  Document,
  FilterQuery,
  Model,
  QueryOptions,
  UpdateQuery,
  PopulateOptions,
  SortOrder,
  PipelineStage,
} from 'mongoose';

export type TDocument<T> = T & Document;

export interface PaginationResult<T> {
  docs: TDocument<T>[] | any[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, SortOrder>;
  select?: string | Record<string, boolean>;
  populate?: PopulateOptions | PopulateOptions[];
  lean?: boolean;
}

export interface FindOptions {
  sort?: Record<string, SortOrder>;
  select?: string | Record<string, boolean>;
  populate?: PopulateOptions | PopulateOptions[];
  lean?: boolean;
  session?: ClientSession;
}

export abstract class BaseAbstractRepository<T> {
  protected model: Model<TDocument<T>>;

  protected constructor(model: Model<TDocument<T>>) {
    this.model = model;
  }

  /**
   * Create a single document
   */
  public async create(
    data: Partial<T>,
    session?: ClientSession,
  ): Promise<TDocument<T>> {
    try {
      const [newDocument] = await this.model.create([data], { session });
      return newDocument;
    } catch (error) {
      throw new BadRequestException(`Failed to create ${this.model.modelName}: ${error.message}`);
    }
  }

  /**
   * Create multiple documents
   */
  public async createMany(
    data: Partial<T>[],
    session?: ClientSession,
  ): Promise<TDocument<T>[]> {
    try {
      const newDocuments = await this.model.create(data, { session });
      return newDocuments;
    } catch (error) {
      throw new BadRequestException(`Failed to create ${this.model.modelName} documents: ${error.message}`);
    }
  }

  /**
   * Find a single document
   */
  public async findOne(
    filterQuery: FilterQuery<TDocument<T>>,
    options: FindOptions = {},
  ): Promise<TDocument<T> | null> {
    const { sort, select, populate, lean = false, session } = options;
    
    let query = this.model.findOne(filterQuery, select);
    
    if (sort) query = query.sort(sort);
    if (populate) query = query.populate(populate) as any;
    if (session) query = query.session(session);
    
    if (lean) {
      return query.lean().exec() as any;
    }
    
    return query.exec();
  }

  /**
   * Find a single document or throw NotFoundException
   */
  public async findOneOrFail(
    filterQuery: FilterQuery<TDocument<T>>,
    options: FindOptions = {},
  ): Promise<TDocument<T>> {
    const document = await this.findOne(filterQuery, options);
    
    if (!document) {
      throw new NotFoundException(`${this.model.modelName} not found`);
    }
    
    return document;
  }

  /**
   * Find multiple documents
   */
  public async find(
    filterQuery: FilterQuery<TDocument<T>> = {},
    options: FindOptions = {},
  ): Promise<TDocument<T>[] | any[]> {
    const { sort, select, populate, lean = false, session } = options;
    
    let query = this.model.find(filterQuery, select);
    
    if (sort) query = query.sort(sort);
    if (populate) query = query.populate(populate) as any;
    if (session) query = query.session(session);
    
    if (lean) {
      return query.lean().exec() as any;
    }
    
    return query.exec();
  }

  /**
   * Find documents with pagination
   */
  public async findWithPagination(
    filterQuery: FilterQuery<TDocument<T>> = {},
    paginationOptions: PaginationOptions = {},
  ): Promise<PaginationResult<T>> {
    const {
      page = 1,
      limit = 10,
      sort,
      select,
      populate,
      lean = true,
    } = paginationOptions;

    try {
      // Check if the model has paginate method (from mongoose-paginate-v2)
      if ('paginate' in this.model) {
        const options = {
          page,
          limit,
          sort,
          select,
          populate,
          lean,
          collation: { locale: 'en', caseLevel: true, numericOrdering: true },
        };

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return await this.model.paginate(filterQuery, options);
      }

      // Fallback to manual pagination
      const skip = (page - 1) * limit;
      const totalDocs = await this.model.countDocuments(filterQuery);
      
      let query = this.model.find(filterQuery, select).skip(skip).limit(limit);
      
      if (sort) query = query.sort(sort);
      if (populate) query = query.populate(populate) as any;
      
      let docs: any;
      if (lean) {
        docs = await query.lean().exec();
      } else {
        docs = await query.exec();
      }
      
      const totalPages = Math.ceil(totalDocs / limit);
      
      return {
        docs,
        totalDocs,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch ${this.model.modelName} documents: ${error.message}`);
    }
  }

  /**
   * Update a single document
   */
  public async updateOne(
    filterQuery: FilterQuery<TDocument<T>>,
    updateQuery: UpdateQuery<TDocument<T>>,
    options: QueryOptions & { session?: ClientSession } = {},
  ): Promise<TDocument<T>> {
    const { session, ...queryOptions } = options;
    
    const updatedDoc = await this.model.findOneAndUpdate(
      filterQuery,
      updateQuery,
      {
        new: true,
        runValidators: true,
        session,
        ...queryOptions,
      },
    );

    if (!updatedDoc) {
      throw new NotFoundException(`${this.model.modelName} not found for update`);
    }

    return updatedDoc;
  }

  /**
   * Update a single document without returning the document
   */
  public async updateOneVoid(
    filterQuery: FilterQuery<TDocument<T>>,
    updateQuery: UpdateQuery<TDocument<T>>,
    options: { session?: ClientSession } = {},
  ): Promise<{ acknowledged: boolean; modifiedCount: number; matchedCount: number }> {
    const result = await this.model.updateOne(filterQuery, updateQuery, options as any);
    return {
      acknowledged: result.acknowledged,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  }

  /**
   * Update multiple documents
   */
  public async updateMany(
    filterQuery: FilterQuery<TDocument<T>>,
    updateQuery: UpdateQuery<TDocument<T>>,
    options: { session?: ClientSession } = {},
  ): Promise<{ acknowledged: boolean; modifiedCount: number; matchedCount: number }> {
    const result = await this.model.updateMany(filterQuery, updateQuery, options as any);
    return {
      acknowledged: result.acknowledged,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  }

  /**
   * Delete a single document
   */
  public async deleteOne(
    filterQuery: FilterQuery<TDocument<T>>,
    session?: ClientSession,
  ): Promise<TDocument<T> | null> {
    const deletedDoc = await this.model.findOneAndDelete(filterQuery, { session });
    return deletedDoc;
  }

  /**
   * Delete a single document or throw NotFoundException
   */
  public async deleteOneOrFail(
    filterQuery: FilterQuery<TDocument<T>>,
    session?: ClientSession,
  ): Promise<TDocument<T>> {
    const deletedDoc = await this.deleteOne(filterQuery, session);
    
    if (!deletedDoc) {
      throw new NotFoundException(`${this.model.modelName} not found for deletion`);
    }
    
    return deletedDoc;
  }

  /**
   * Delete multiple documents
   */
  public async deleteMany(
    filterQuery: FilterQuery<TDocument<T>>,
    session?: ClientSession,
  ): Promise<{ acknowledged: boolean; deletedCount: number }> {
    const result = await this.model.deleteMany(filterQuery, { session });
    return {
      acknowledged: result.acknowledged,
      deletedCount: result.deletedCount,
    };
  }

  /**
   * Count documents
   */
  public async count(
    filterQuery: FilterQuery<TDocument<T>> = {},
    session?: ClientSession,
  ): Promise<number> {
    return this.model.countDocuments(filterQuery, { session });
  }

  /**
   * Check if document exists
   */
  public async exists(
    filterQuery: FilterQuery<TDocument<T>>,
    session?: ClientSession,
  ): Promise<boolean> {
    const doc = await this.model.exists(filterQuery).session(session || null);
    return !!doc;
  }

  /**
   * Find by ID
   */
  public async findById(
    id: string,
    options: FindOptions = {},
  ): Promise<TDocument<T> | null> {
    const { select, populate, lean = false, session } = options;
    
    let query = this.model.findById(id, select);
    
    if (populate) query = query.populate(populate) as any;
    if (session) query = query.session(session);
    
    if (lean) {
      return query.lean().exec() as any;
    }
    
    return query.exec();
  }

  /**
   * Find by ID or throw NotFoundException
   */
  public async findByIdOrFail(
    id: string,
    options: FindOptions = {},
  ): Promise<TDocument<T>> {
    const document = await this.findById(id, options);
    
    if (!document) {
      throw new NotFoundException(`${this.model.modelName} with ID ${id} not found`);
    }
    
    return document;
  }

  /**
   * Update by ID
   */
  public async updateById(
    id: string,
    updateQuery: UpdateQuery<TDocument<T>>,
    options: QueryOptions & { session?: ClientSession } = {},
  ): Promise<TDocument<T>> {
    return this.updateOne({ _id: id } as FilterQuery<TDocument<T>>, updateQuery, options);
  }

  /**
   * Delete by ID
   */
  public async deleteById(
    id: string,
    session?: ClientSession,
  ): Promise<TDocument<T> | null> {
    return this.deleteOne({ _id: id } as FilterQuery<TDocument<T>>, session);
  }

  /**
   * Aggregate with pagination support
   */
  public async aggregate(
    pipeline: PipelineStage[],
    options?: any,
  ): Promise<any[]> {
    return this.model.aggregate(pipeline, options);
  }

  /**
   * Aggregate with pagination (requires mongoose-aggregate-paginate-v2)
   */
  public async aggregateWithPagination(
    pipeline: PipelineStage[],
    paginationOptions: PaginationOptions = {},
  ): Promise<any> {
    const { page = 1, limit = 10 } = paginationOptions;
    
    // Check if the model has aggregatePaginate method
    if ('aggregatePaginate' in this.model) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return this.model.aggregatePaginate(
        this.model.aggregate(pipeline),
        { page, limit },
      );
    }
    
    // Fallback to manual pagination
    const countPipeline = [...pipeline, { $count: 'totalDocs' }];
    const [countResult] = await this.model.aggregate(countPipeline);
    const totalDocs = countResult?.totalDocs || 0;
    
    const skip = (page - 1) * limit;
    const paginatedPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limit },
    ];
    
    const docs = await this.model.aggregate(paginatedPipeline);
    const totalPages = Math.ceil(totalDocs / limit);
    
    return {
      docs,
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    };
  }

  /**
   * Bulk write operations
   */
  public async bulkWrite(
    operations: any[],
    options: any = {},
  ): Promise<any> {
    return this.model.bulkWrite(operations, options);
  }

  /**
   * Get distinct values for a field
   */
  public async distinct(
    field: string,
    filterQuery: FilterQuery<TDocument<T>> = {},
    session?: ClientSession,
  ): Promise<any[]> {
    if (session) {
      return this.model.distinct(field, filterQuery).session(session);
    }
    return this.model.distinct(field, filterQuery);
  }

  /**
   * Execute a transaction with automatic retry
   */
  public async executeTransaction<R>(
    operation: (session: ClientSession) => Promise<R>,
    options?: any,
  ): Promise<R> {
    const session = await this.model.db.startSession();
    
    try {
      return await session.withTransaction(operation, options) as R;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  public async findAllWithPaginationOption(
    queryFiltersAndOptions: any,
    arrayOfFilters: string[],
    extraOptions = {},
  ): Promise<any> {
    const filters: FilterQuery<TDocument<T>> = _.pick(
      queryFiltersAndOptions,
      arrayOfFilters,
    );
    
    if (queryFiltersAndOptions.allowPagination) {
      const paginationOptions = {
        page: queryFiltersAndOptions.page || 1,
        limit: queryFiltersAndOptions.limit || 10,
        lean: true,
        ...extraOptions,
      };
      
      return this.findWithPagination(filters, paginationOptions);
    } else {
      const docs = await this.find(filters, { lean: true, ...extraOptions });
      return { docs };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  public async createDoc(data: T): Promise<TDocument<T>> {
    return this.create(data as Partial<T>);
  }

  /**
   * Legacy method for backward compatibility
   */
  public async updateAllVoid(
    filterQuery: FilterQuery<TDocument<T>>,
    updateQuery: UpdateQuery<TDocument<T>>,
    options: { session?: ClientSession } = {},
  ): Promise<void> {
    await this.updateMany(filterQuery, updateQuery, options);
  }
}
