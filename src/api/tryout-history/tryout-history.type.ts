export type TotalUsersOfOption = {
    option_id: string;
    total_users: number;
};

export type SubjectAnalyticType = {
    id: string;
    name: string; 
    set_count: number;
    avg_score: number;
    max_score: number;
    min_score: number;
    topics: {
        id: string,
        name: string,
        correct_answers_count: number,
        questions_count: number,
    }[];
};