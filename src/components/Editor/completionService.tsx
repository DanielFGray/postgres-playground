import { languages } from "monaco-editor/esm/vs/editor/editor.api";
import {
    CompletionService,
    ICompletionItem,
    StmtContextType
} from "monaco-sql-languages";

export const completionService: CompletionService = function(
    model,
    position,
    completionContext,
    suggestions, // syntax context info at caretPosition
    entities
) {
    return new Promise((resolve, reject) => {
        if (!suggestions) {
            return Promise.resolve([]);
        }
        const { keywords, syntax } = suggestions;
        const keywordsCompletionItems: ICompletionItem[] = keywords.map(kw => ({
            label: kw,
            kind: languages.CompletionItemKind.Keyword,
            detail: "keyword",
            sortText: "2" + kw,
        }));

        let syntaxCompletionItems: ICompletionItem[] = [];

        syntax.forEach(item => {
            console.log(item.syntaxContextType);
            if (item.syntaxContextType === StmtContextType.SELECT_STMT) {
                const tableCompletions: ICompletionItem[] = []; // some completions about select statements
                syntaxCompletionItems = [...syntaxCompletionItems, ...tableCompletions];
            }
        });

        resolve([...syntaxCompletionItems, ...keywordsCompletionItems]);
    });
};

